#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(
  BACKUP_R2_ACCESS_KEY_ID
  BACKUP_R2_SECRET_ACCESS_KEY
  BACKUP_R2_ENDPOINT
  BACKUP_R2_BUCKET
  RESTIC_PASSWORD
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Missing required restore-drill configuration: ${name}"
    exit 1
  fi
done

work_dir="$(mktemp -d)"
network_name="orqena-restore-${RANDOM}-${RANDOM}"
container_name="orqena-restore-db-${RANDOM}-${RANDOM}"
cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
  docker network rm "${network_name}" >/dev/null 2>&1 || true
  rm -rf -- "${work_dir}"
}
trap cleanup EXIT

export AWS_ACCESS_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"
export RESTIC_REPOSITORY="s3:${BACKUP_R2_ENDPOINT%/}/${BACKUP_R2_BUCKET}/postgresql"
export RESTIC_CACHE_DIR="${work_dir}/restic-cache"

restore_root="${work_dir}/restore"
mkdir -p "${restore_root}"
started_at="$(date +%s)"
snapshot_json="${work_dir}/latest-snapshot.json"
restic snapshots --latest 1 --tag postgresql --json >"${snapshot_json}"
maximum_snapshot_age_hours="${MAXIMUM_SNAPSHOT_AGE_HOURS:-7}"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const snapshots = JSON.parse(readFileSync(process.argv[1], "utf8"));
  const maximumAgeHours = Number(process.argv[2]);
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours <= 0) process.exit(2);
  const latest = snapshots.at(-1);
  const timestamp = Date.parse(latest?.time ?? "");
  const ageHours = (Date.now() - timestamp) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours > maximumAgeHours) {
    process.stderr.write("Latest encrypted snapshot is outside the permitted RPO window.\n");
    process.exit(1);
  }
' "${snapshot_json}" "${maximum_snapshot_age_hours}"
snapshot_id="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const snapshots = JSON.parse(readFileSync(process.argv[1], "utf8"));
  const latest = snapshots.at(-1);
  if (!latest?.id) process.exit(1);
  process.stdout.write(latest.id);
' "${snapshot_json}")"
restic restore "${snapshot_id}" --target "${restore_root}" >/dev/null

dump_path="$(find "${restore_root}" -type f -name database.dump -print -quit)"
manifest_path="$(find "${restore_root}" -type f -name manifest.json -print -quit)"
if [[ -z "${dump_path}" || -z "${manifest_path}" ]]; then
  echo "::error::Latest snapshot does not contain the required dump and manifest."
  exit 1
fi

expected_checksum="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1], "utf8")).sha256);' "${manifest_path}")"
manifest_migration_count="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(JSON.parse(readFileSync(process.argv[1], "utf8")).migrationCount ?? ""));' "${manifest_path}")"
manifest_migration_head="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(JSON.parse(readFileSync(process.argv[1], "utf8")).migrationHead ?? ""));' "${manifest_path}")"
if [[ ! "${manifest_migration_count}" =~ ^[1-9][0-9]*$ || -z "${manifest_migration_head}" ]]; then
  echo "::error::Snapshot manifest lacks a valid migration baseline."
  exit 1
fi
actual_checksum="$(sha256sum "${dump_path}" | awk '{print $1}')"
if [[ "${actual_checksum}" != "${expected_checksum}" ]]; then
  echo "::error::Restored dump checksum mismatch."
  exit 1
fi

postgres_image="${POSTGRES_CLIENT_IMAGE:-postgres:18.4-bookworm}"
docker pull --quiet "${postgres_image}" >/dev/null
docker run --rm --mount "type=bind,source=$(dirname "${dump_path}"),target=/restore,readonly" \
  "${postgres_image}" pg_restore --list /restore/database.dump >/dev/null

restore_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
docker network create "${network_name}" >/dev/null
docker run -d --rm \
  --network "${network_name}" \
  --name "${container_name}" \
  -e POSTGRES_PASSWORD="${restore_password}" \
  -e POSTGRES_DB=orqena_restore_drill \
  "${postgres_image}" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "${container_name}" pg_isready -U postgres -d orqena_restore_drill >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "${container_name}" pg_isready -U postgres -d orqena_restore_drill >/dev/null

docker run --rm \
  --network "${network_name}" \
  -e PGPASSWORD="${restore_password}" \
  --mount "type=bind,source=$(dirname "${dump_path}"),target=/restore,readonly" \
  "${postgres_image}" \
  pg_restore --exit-on-error --no-owner --no-acl \
  --host "${container_name}" --username postgres --dbname orqena_restore_drill \
  /restore/database.dump >/dev/null

query_restore() {
  local sql="$1"
  docker exec -e PGPASSWORD="${restore_password}" "${container_name}" \
    psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --username postgres --dbname orqena_restore_drill --command "${sql}"
}

migration_count="$(query_restore "select count(*) from \"_prisma_migrations\" where finished_at is not null and rolled_back_at is null;" | tr -d '\r\n ')"
migration_head="$(query_restore "select migration_name from \"_prisma_migrations\" where finished_at is not null and rolled_back_at is null order by finished_at desc, migration_name desc limit 1;" | tr -d '\r\n')"
critical_table_count="$(query_restore "select count(*) from information_schema.tables where table_schema='public' and table_name in ('User','Company','CompanyMembership','Client','Work','Invoice','Document');" | tr -d '\r\n ')"
aggregate_counts="$(query_restore "select (select count(*) from \"Company\"), (select count(*) from \"CompanyMembership\"), (select count(*) from \"Client\"), (select count(*) from \"Work\"), (select count(*) from \"Invoice\"), (select count(*) from \"Document\");" | tr -d '\r\n')"

if [[ "${critical_table_count}" != "7" ]]; then
  echo "::error::One or more critical tables are missing after restore."
  exit 1
fi
if [[ "${migration_count}" != "${manifest_migration_count}" || "${migration_head}" != "${manifest_migration_head}" ]]; then
  echo "::error::Restored migration baseline does not match the snapshot manifest."
  exit 1
fi

tenant_relation_violations="$(query_restore "select count(*) from \"CompanyMembership\" m left join \"Company\" c on c.id=m.\"companyId\" where c.id is null;" | tr -d '\r\n ')"
if [[ "${tenant_relation_violations}" != "0" ]]; then
  echo "::error::Restore drill found broken tenant membership relations."
  exit 1
fi

restic check --read-data >/dev/null
rto_seconds="$(( $(date +%s) - started_at ))"
echo "Restore drill passed: ${migration_count} migrations; head ${migration_head}; RTO ${rto_seconds}s; aggregate tuple ${aggregate_counts}."

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "migration_count=${migration_count}"
    echo "migration_head=${migration_head}"
    echo "critical_table_count=${critical_table_count}"
    echo "tenant_relation_violations=${tenant_relation_violations}"
    echo "rto_seconds=${rto_seconds}"
    echo "checksum_prefix=${actual_checksum:0:12}"
  } >>"${GITHUB_OUTPUT}"
fi

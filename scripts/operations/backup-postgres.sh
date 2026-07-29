#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(
  BACKUP_DATABASE_URL
  BACKUP_R2_ACCESS_KEY_ID
  BACKUP_R2_SECRET_ACCESS_KEY
  BACKUP_R2_ENDPOINT
  BACKUP_R2_BUCKET
  RESTIC_PASSWORD
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Missing required backup configuration: ${name}"
    exit 1
  fi
done

work_dir="$(mktemp -d)"
payload_dir="${work_dir}/snapshot"
mkdir -p "${payload_dir}"
cleanup() {
  rm -rf -- "${work_dir}"
}
trap cleanup EXIT

export AWS_ACCESS_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"
export RESTIC_REPOSITORY="s3:${BACKUP_R2_ENDPOINT%/}/${BACKUP_R2_BUCKET}/postgresql"
export RESTIC_CACHE_DIR="${work_dir}/restic-cache"
export PGCONNECT_TIMEOUT=20

postgres_image="${POSTGRES_CLIENT_IMAGE:-postgres:18.4-bookworm}"
dump_path="${payload_dir}/database.dump"
dump_stderr="${work_dir}/pg-dump.stderr"

docker pull --quiet "${postgres_image}" >/dev/null
timeout 20m docker run --rm \
  -e BACKUP_DATABASE_URL \
  -e PGCONNECT_TIMEOUT \
  --mount "type=bind,source=${payload_dir},target=/backup" \
  "${postgres_image}" \
  bash -Eeuo pipefail -c \
  'pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl --file=/backup/database.dump' \
  2>"${dump_stderr}"

if [[ -s "${dump_stderr}" ]]; then
  echo "::error::pg_dump wrote diagnostics; the snapshot was rejected."
  exit 1
fi

archive_list="${work_dir}/archive-list.txt"
docker run --rm \
  --mount "type=bind,source=${payload_dir},target=/backup,readonly" \
  "${postgres_image}" \
  pg_restore --list /backup/database.dump >"${archive_list}"
server_version="$(sed -n 's/^;[[:space:]]*Dumped from database version:[[:space:]]*//p' "${archive_list}" | head -n 1 | tr -d '\r\n')"
if [[ -z "${server_version}" ]]; then
  echo "::error::Unable to derive the PostgreSQL server version from the dump archive."
  exit 1
fi

migration_sql="${work_dir}/prisma-migrations.sql"
docker run --rm \
  --mount "type=bind,source=${payload_dir},target=/backup,readonly" \
  --mount "type=bind,source=${work_dir},target=/metadata" \
  "${postgres_image}" \
  pg_restore --data-only --table=_prisma_migrations \
  --file=/metadata/prisma-migrations.sql /backup/database.dump
node scripts/operations/extract-prisma-migration-metadata.mjs \
  "${migration_sql}" >"${work_dir}/prisma-migration-metadata.json"

migration_count="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(JSON.parse(readFileSync(process.argv[1], "utf8")).migrationCount));' "${work_dir}/prisma-migration-metadata.json")"
migration_head="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1], "utf8")).migrationHead);' "${work_dir}/prisma-migration-metadata.json")"
dump_size="$(wc -c < "${dump_path}" | tr -d ' ')"
dump_checksum="$(sha256sum "${dump_path}" | awk '{print $1}')"
application_sha="${GITHUB_SHA:-unknown}"
timestamp_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

export BACKUP_MANIFEST_TIMESTAMP="${timestamp_utc}"
export BACKUP_MANIFEST_POSTGRES_VERSION="${server_version}"
export BACKUP_MANIFEST_MIGRATION_COUNT="${migration_count}"
export BACKUP_MANIFEST_MIGRATION_HEAD="${migration_head}"
export BACKUP_MANIFEST_SIZE="${dump_size}"
export BACKUP_MANIFEST_CHECKSUM="${dump_checksum}"
export BACKUP_MANIFEST_APP_SHA="${application_sha}"
node --input-type=module -e '
  import { writeFileSync } from "node:fs";
  const manifest = {
    schemaVersion: 1,
    timestampUtc: process.env.BACKUP_MANIFEST_TIMESTAMP,
    postgresVersion: process.env.BACKUP_MANIFEST_POSTGRES_VERSION,
    migrationCount: Number(process.env.BACKUP_MANIFEST_MIGRATION_COUNT),
    migrationHead: process.env.BACKUP_MANIFEST_MIGRATION_HEAD,
    metadataSource: "PG_DUMP_ARCHIVE",
    dumpBytes: Number(process.env.BACKUP_MANIFEST_SIZE),
    sha256: process.env.BACKUP_MANIFEST_CHECKSUM,
    applicationSha: process.env.BACKUP_MANIFEST_APP_SHA,
    pgRestoreListValidation: "PASS",
    recoveryModel: "SNAPSHOT_WITHOUT_PITR"
  };
  writeFileSync(process.argv[1], `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
' "${payload_dir}/manifest.json"

if ! restic cat config >/dev/null 2>&1; then
  echo "::error::The encrypted repository is not initialized. Refusing to create a one-key repository in automation."
  exit 1
fi

backup_json="${work_dir}/restic-backup.jsonl"
(
  cd "${work_dir}"
  restic backup snapshot \
  --host orqena-production \
  --tag postgresql \
  --tag "application-${application_sha}" \
  --json >"${backup_json}"
)

snapshot_id="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const messages = readFileSync(process.argv[1], "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
  const summary = messages.findLast((entry) => entry.message_type === "summary");
  if (!summary?.snapshot_id) process.exit(1);
  process.stdout.write(summary.snapshot_id);
' "${backup_json}")"

restic check >/dev/null

checksum_prefix="${dump_checksum:0:12}"
snapshot_short="${snapshot_id:0:12}"
echo "PostgreSQL snapshot completed: ${snapshot_short}; ${dump_size} bytes; checksum ${checksum_prefix}."

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "snapshot_id=${snapshot_short}"
    echo "dump_bytes=${dump_size}"
    echo "checksum_prefix=${checksum_prefix}"
    echo "migration_count=${migration_count}"
    echo "migration_head=${migration_head}"
    echo "timestamp_utc=${timestamp_utc}"
    echo "repository_created=false"
  } >>"${GITHUB_OUTPUT}"
fi

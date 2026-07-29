#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(
  DOCUMENTS_SOURCE_R2_ACCESS_KEY_ID
  DOCUMENTS_SOURCE_R2_SECRET_ACCESS_KEY
  DOCUMENTS_SOURCE_R2_ENDPOINT
  DOCUMENTS_SOURCE_R2_BUCKET
  BACKUP_R2_ACCESS_KEY_ID
  BACKUP_R2_SECRET_ACCESS_KEY
  BACKUP_R2_ENDPOINT
  BACKUP_R2_BUCKET
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Missing required document-backup configuration: ${name}"
    exit 1
  fi
done

if [[ "${DOCUMENTS_SOURCE_R2_ENDPOINT%/}" == "${BACKUP_R2_ENDPOINT%/}" && "${DOCUMENTS_SOURCE_R2_BUCKET}" == "${BACKUP_R2_BUCKET}" ]]; then
  echo "::error::Document source and backup destination must be different buckets."
  exit 1
fi

version_retention_days="${DOCUMENTS_VERSION_RETENTION_DAYS:-365}"
if [[ ! "${version_retention_days}" =~ ^[0-9]+$ || "${version_retention_days}" -lt 30 ]]; then
  echo "::error::Document version retention must be an integer of at least 30 days."
  exit 1
fi

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "${work_dir}"
}
trap cleanup EXIT

config_path="${work_dir}/rclone.conf"
cat >"${config_path}" <<EOF
[documents-source]
type = s3
provider = Cloudflare
access_key_id = ${DOCUMENTS_SOURCE_R2_ACCESS_KEY_ID}
secret_access_key = ${DOCUMENTS_SOURCE_R2_SECRET_ACCESS_KEY}
endpoint = ${DOCUMENTS_SOURCE_R2_ENDPOINT}
no_check_bucket = true

[backup-destination]
type = s3
provider = Cloudflare
access_key_id = ${BACKUP_R2_ACCESS_KEY_ID}
secret_access_key = ${BACKUP_R2_SECRET_ACCESS_KEY}
endpoint = ${BACKUP_R2_ENDPOINT}
no_check_bucket = true
EOF
chmod 600 "${config_path}"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
source_path="documents-source:${DOCUMENTS_SOURCE_R2_BUCKET}"
current_path="backup-destination:${BACKUP_R2_BUCKET}/documents/current"
version_path="backup-destination:${BACKUP_R2_BUCKET}/documents/versions/${timestamp}"
filters=(
  --exclude '/codex-smoke/**'
  --exclude '/tmp/**'
  --exclude '/temporary/**'
)

dry_run_log="${work_dir}/dry-run.log"
rclone sync "${source_path}" "${current_path}" \
  --config "${config_path}" \
  --backup-dir "${version_path}" \
  --checksum \
  --metadata \
  --fast-list \
  --dry-run \
  "${filters[@]}" >"${dry_run_log}" 2>&1

change_count="$(grep -Ec 'NOTICE:|INFO  :' "${dry_run_log}" || true)"
echo "Document backup dry-run passed; planned log entries: ${change_count}."

if [[ "${DOCUMENTS_BACKUP_DRY_RUN_ONLY:-false}" != "true" ]]; then
  rclone sync "${source_path}" "${current_path}" \
    --config "${config_path}" \
    --backup-dir "${version_path}" \
    --checksum \
    --metadata \
    --fast-list \
    "${filters[@]}"
  rclone check "${source_path}" "${current_path}" \
    --config "${config_path}" \
    --checksum \
    --one-way \
    "${filters[@]}"
  rclone delete "backup-destination:${BACKUP_R2_BUCKET}/documents/versions" \
    --config "${config_path}" \
    --min-age "${version_retention_days}d" \
    --rmdirs
  echo "Document backup completed at ${timestamp}."
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "timestamp=${timestamp}"
    echo "dry_run_entries=${change_count}"
    echo "dry_run_only=${DOCUMENTS_BACKUP_DRY_RUN_ONLY:-false}"
  } >>"${GITHUB_OUTPUT}"
fi

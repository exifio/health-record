#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/tmp" "$test_root/output"

cat > "$test_root/bin/docker" <<'SH'
#!/usr/bin/env sh
printf 'COPY auth.users (\nCOPY auth.identities (\nCOPY public.daily_records (\n'
SH
cat > "$test_root/bin/age" <<'SH'
#!/usr/bin/env sh
cat >/dev/null
printf 'encrypted'
SH
chmod +x "$test_root/bin/docker" "$test_root/bin/age"

set +e
archive_path="$(
  SUPABASE_DB_URL='postgresql://backup:test@localhost/postgres?sslmode=require' \
  AGE_RECIPIENT='age1test' \
  BACKUP_SOURCE_REVISION="$(git -C "$repo_root" rev-parse HEAD)" \
  TMPDIR="$test_root/tmp" \
  PATH="$test_root/bin:$PATH" \
    "$repo_root/scripts/backup/supabase-backup.sh" create "$test_root/output"
)" 2>"$test_root/stderr"
backup_status=$?
set -e

[[ "$backup_status" -eq 0 && -f "$archive_path" ]] || {
  printf 'expected the simulated encrypted backup to succeed\n' >&2
  exit 1
}
if find "$test_root/tmp" -mindepth 1 -print -quit | grep -q .; then
  printf 'backup temporary files remained after a successful backup\n' >&2
  exit 1
fi

#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly POSTGRES_CLIENT_IMAGE="postgres:17-alpine"
readonly SUPABASE_CLI_VERSION="2.118.0"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cleanup_work_dir=''
cleanup_partial_archive=''

cleanup_temporary_files() {
  [[ -z "$cleanup_work_dir" ]] || rm -rf -- "$cleanup_work_dir"
  [[ -z "$cleanup_partial_archive" ]] || rm -f -- "$cleanup_partial_archive"
}

trap cleanup_temporary_files EXIT

fail() {
  printf 'supabase-backup: %s\n' "$1" >&2
  exit 1
}

require_tls_url() {
  case "$1" in
    *sslmode=require*|*sslmode=verify-ca*|*sslmode=verify-full*) ;;
    *) fail 'database URLs must enable TLS with sslmode=require (or stronger)' ;;
  esac
}

create_backup() {
  local output_dir="$1"
  local source_revision timestamp work_dir partial_archive archive_name

  : "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
  : "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
  [[ "$AGE_RECIPIENT" == age1* ]] || fail 'AGE_RECIPIENT is not a valid age recipient'
  require_tls_url "$SUPABASE_DB_URL"

  for command_name in age docker git tar; do
    command -v "$command_name" >/dev/null || fail "required command is missing: $command_name"
  done

  source_revision="${BACKUP_SOURCE_REVISION:-$(git -C "$repo_root" rev-parse HEAD)}"
  [[ "$source_revision" =~ ^[0-9a-f]{40}$ ]] || fail 'backup source revision must be a full Git commit SHA'
  [[ -z "$(git -C "$repo_root" status --porcelain -- supabase/migrations)" ]] \
    || fail 'database migrations have uncommitted changes; commit them before backing up'

  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  archive_name="supabase-${timestamp}-${source_revision:0:12}.tar.gz.age"
  mkdir -p "$output_dir"
  output_dir="$(cd "$output_dir" && pwd -P)"
  case "$output_dir/" in
    "$repo_root/"*) fail 'backup output must be outside the public repository' ;;
  esac
  work_dir="$(mktemp -d "${TMPDIR:-/tmp}/health-record-backup.XXXXXX")"
  cleanup_work_dir="$work_dir"
  partial_archive="$output_dir/${archive_name}.partial"
  cleanup_partial_archive="$partial_archive"
  case "$work_dir/" in
    "$repo_root/"*) fail 'plaintext backup data must stay outside the public repository' ;;
  esac

  cat > "$work_dir/manifest.txt" <<EOF
created_at_utc=$timestamp
schema_source_commit=$source_revision
postgres_client_major=17
included_data=public.*,auth.users,auth.identities
excluded_auth_data=all other auth tables
EOF

  docker run --rm --env SUPABASE_DB_URL "$POSTGRES_CLIENT_IMAGE" sh -eu -c '
    pg_dump \
      --dbname="$SUPABASE_DB_URL" \
      --data-only \
      --no-owner \
      --no-privileges \
      --no-comments \
      --table="public.*" \
      --table="auth.users" \
      --table="auth.identities"
  ' > "$work_dir/data.sql"

  grep -Fq 'COPY auth.users (' "$work_dir/data.sql" || fail 'Auth users were not present in the database dump'
  grep -Fq 'COPY auth.identities (' "$work_dir/data.sql" || fail 'Auth identities were not present in the database dump'
  grep -Fq 'COPY public.' "$work_dir/data.sql" || fail 'application data was not present in the database dump'

  tar -C "$work_dir" -czf - manifest.txt data.sql | age -r "$AGE_RECIPIENT" > "$partial_archive"
  mv "$partial_archive" "$output_dir/$archive_name"
  printf '%s/%s\n' "$output_dir" "$archive_name"
}

check_empty_restore_target() {
  psql -w "$SUPABASE_RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE
  table_name text;
  table_has_rows boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1)
     OR EXISTS (SELECT 1 FROM auth.identities LIMIT 1) THEN
    RAISE EXCEPTION 'restore target already contains Auth data';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'daily_records', 'record_messages',
    'daily_summaries', 'record_suggestions', 'corrections'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)', table_name)
        INTO table_has_rows;
      IF table_has_rows THEN
        RAISE EXCEPTION 'restore target already contains application data';
      END IF;
    END IF;
  END LOOP;
END;
$$;
SQL
}

restore_backup() {
  local archive_path="$1"
  local identity_file="$2"
  local work_dir current_revision source_revision listing expected_listing

  : "${SUPABASE_RESTORE_DB_URL:?SUPABASE_RESTORE_DB_URL is required}"
  require_tls_url "$SUPABASE_RESTORE_DB_URL"
  [[ -f "$archive_path" ]] || fail 'encrypted backup archive does not exist'
  [[ -f "$identity_file" ]] || fail 'age identity file does not exist'

  for command_name in age cmp git npx psql sort tar; do
    command -v "$command_name" >/dev/null || fail "required command is missing: $command_name"
  done

  work_dir="$(mktemp -d "${TMPDIR:-/tmp}/health-record-restore.XXXXXX")"
  cleanup_work_dir="$work_dir"
  listing="$work_dir/archive-files.txt"
  expected_listing="$work_dir/expected-files.txt"

  age --decrypt --identity "$identity_file" "$archive_path" | tar -tvzf - > "$listing" \
    || fail 'backup decryption or archive validation failed'
  printf 'data.sql\nmanifest.txt\n' | sort > "$expected_listing"
  awk 'substr($0, 1, 1) != "-" { exit 1 } { print $NF }' "$listing" | sort > "$listing.files" \
    || fail 'backup archive contains a non-regular file'
  mv "$listing.files" "$listing"
  cmp -s "$listing" "$expected_listing" || fail 'backup archive has unexpected contents'
  age --decrypt --identity "$identity_file" "$archive_path" \
    | tar -xzf - -C "$work_dir" \
    || fail 'backup extraction failed'

  source_revision="$(sed -n 's/^schema_source_commit=//p' "$work_dir/manifest.txt")"
  [[ "$source_revision" =~ ^[0-9a-f]{40}$ ]] || fail 'backup manifest has no valid schema source commit'
  current_revision="$(git -C "$repo_root" rev-parse HEAD)"
  [[ "$current_revision" == "$source_revision" ]] \
    || fail "checkout the schema source commit from the backup before restoring"
  [[ -z "$(git -C "$repo_root" status --porcelain -- supabase/migrations)" ]] \
    || fail 'database migrations differ from the backup schema source commit'

  check_empty_restore_target
  npx --yes "supabase@$SUPABASE_CLI_VERSION" db push \
    --db-url "$SUPABASE_RESTORE_DB_URL" --include-all --yes --log-level error

  psql -w "$SUPABASE_RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -q \
    --single-transaction \
    -c "SET session_replication_role = replica" \
    -f "$work_dir/data.sql"

  psql -w "$SUPABASE_RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE
  enabled_rls_tables integer;
BEGIN
  SELECT count(*) INTO enabled_rls_tables
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'profiles', 'daily_records', 'record_messages',
      'daily_summaries', 'record_suggestions', 'corrections'
    ])
    AND c.relrowsecurity;

  IF enabled_rls_tables <> 6 THEN
    RAISE EXCEPTION 'application RLS verification failed';
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_trigger AS t
      JOIN pg_class AS c ON c.oid = t.tgrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth' AND c.relname = 'users'
        AND t.tgname = 'on_auth_user_created' AND NOT t.tgisinternal
    ) OR to_regprocedure('public.retry_daily_summary(uuid,date)') IS NULL THEN
    RAISE EXCEPTION 'application trigger or RPC verification failed';
  END IF;

  IF EXISTS (
      SELECT 1 FROM public.profiles AS p
      LEFT JOIN auth.users AS u ON u.id = p.id
      WHERE u.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.daily_records AS r
      LEFT JOIN auth.users AS u ON u.id = r.user_id
      WHERE u.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.record_messages AS m
      LEFT JOIN public.daily_records AS r ON r.id = m.daily_record_id
      WHERE r.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.daily_summaries AS s
      LEFT JOIN public.daily_records AS r ON r.id = s.daily_record_id
      WHERE r.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.record_suggestions AS s
      LEFT JOIN public.daily_records AS r ON r.id = s.daily_record_id
      WHERE r.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.corrections AS c
      LEFT JOIN public.daily_records AS r ON r.id = c.daily_record_id
      WHERE r.id IS NULL
    ) OR EXISTS (
      SELECT 1 FROM auth.identities AS i
      LEFT JOIN auth.users AS u ON u.id = i.user_id
      WHERE u.id IS NULL
    ) THEN
    RAISE EXCEPTION 'restored Auth references do not match';
  END IF;
END;
$$;
SQL

  printf 'Restore finished. Auth sessions were not restored; users must sign in again.\n'
}

case "${1:-}" in
  create)
    [[ $# -eq 2 ]] || fail 'usage: supabase-backup.sh create OUTPUT_DIR'
    create_backup "$2"
    ;;
  restore)
    [[ $# -eq 3 ]] || fail 'usage: SUPABASE_RESTORE_DB_URL=... supabase-backup.sh restore ARCHIVE.age AGE_IDENTITY_FILE'
    restore_backup "$2" "$3"
    ;;
  *)
    fail 'usage: supabase-backup.sh create OUTPUT_DIR | restore ARCHIVE.age AGE_IDENTITY_FILE'
    ;;
esac

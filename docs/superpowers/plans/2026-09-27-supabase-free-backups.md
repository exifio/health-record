# Supabase Free Encrypted Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish daily, encrypted off-site backups for the Supabase Free project and verify that Auth users and application health records can be restored together.

**Architecture:** A GitHub Actions schedule runs one PostgreSQL 17 `pg_dump` snapshot covering `public.*`, `auth.users`, and `auth.identities`, encrypts it with `age`, and uploads only ciphertext to a private Cloudflare R2 bucket. The archive records the Git commit that supplies its schema migrations; restore applies those migrations to a new Supabase Free project before loading data. The workflow removes R2 objects older than 30 days. The decryption key stays outside GitHub.

**Tech Stack:** GitHub Actions, Supabase CLI for restore migrations, PostgreSQL 17 `pg_dump`/`psql`, `age`, Cloudflare R2 S3 API.

**Spec:** `docs/tasks/INTEGRATION_TASKS.md` I-714 and I-718; `docs/SECURITY.md`; `docs/DATABASE.md`.

## Global Constraints

- Keep Supabase Free.
- Keep privacy notice, consent policy, and cross-border legal wording out of scope.
- Never write plaintext health data, backup files, or secret values to the public GitHub repository, workflow artifacts, or logs.
- Preserve the Auth user IDs referenced by `profiles` and `daily_records`.
- Store backups encrypted before upload; keep the decrypt private key offline.
- Preserve unrelated dirty workspace changes.

## Review Focus

- Auth table dump/restore must preserve user IDs and password hashes while restored sessions require sign-in again.
- Restored application tables must retain migrations, RLS, functions, and triggers.
- Any failed dump, encryption, upload, or retention setup must fail the workflow and never publish plaintext.
- Workflow permissions and R2 credentials must be limited to the backup operation.
- A backup is not complete until a restore rehearsal succeeds.

---

### Task 1: Confirm available Supabase, GitHub, and Cloudflare access

**Files:** None.

- [x] Check CLI and connected project details without printing credential values.
- [x] Confirm the target Supabase project and check whether a database connection credential is available.
- [x] Confirm Cloudflare R2 access is unavailable and GitHub Actions variables/secrets can be managed.
- [x] Complete repository-owned work and record the specific external settings still missing.

### Task 2: Build the backup and restore workflow

**Files:**
- Create: `scripts/backup/supabase-backup.sh`
- Create: `.github/workflows/supabase-backup.yml`
- Modify: `docs/tasks/INTEGRATION_TASKS.md`

- [x] Implement one consistent data export for all public application tables and Auth users/identities; exclude transient Auth sessions and tokens.
- [x] Encrypt the archive locally with `age` before upload and keep the private identity outside GitHub.
- [x] Configure upload to R2 and remove only matching backup objects older than 30 days.
- [x] Schedule daily at 18:00 UTC (03:00 Asia/Seoul), gated by an explicit repository variable.
- [x] Verify dump/restore ordering with synthetic PostgreSQL data and validate the archive format.

### Task 3: Configure, run, and verify the production backup

**Files:**
- Modify: `.github/workflows/supabase-backup.yml` only if verification requires it.
- Modify: `docs/tasks/INTEGRATION_TASKS.md` with evidence and remaining gates.

- [ ] Create a private R2 bucket and configure the scoped object token and remaining repository settings.
- [ ] Add the Supabase database URL and R2 credentials to GitHub Actions secrets without exposing values.
- [ ] Run one production backup and confirm ciphertext upload, object privacy, and 30-day pruning.
- [ ] Restore into a separate Supabase Free project and verify Auth IDs, app rows, RLS/functions/triggers, and sign-in behavior.
- [ ] Mark I-718 complete only after the production restore rehearsal succeeds.

**Checkpoint:** The local identity and public GitHub `AGE_RECIPIENT` variable are ready. The production database URL, Cloudflare account/bucket, and R2 access keys are not available in this session, so scheduled production backup and live Supabase restore remain disabled.

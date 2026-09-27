const BACKUP_PATH_PATTERN =
  /^health-record\/supabase\/supabase-\d{8}T\d{6}Z-[0-9a-f]{12}\.tar\.gz\.age$/;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function isManagedBackupPathname(pathname) {
  return typeof pathname === 'string' && BACKUP_PATH_PATTERN.test(pathname);
}

export function expiredBackupPathnames(blobs, now = new Date()) {
  const cutoff = now.getTime() - RETENTION_MS;

  return blobs
    .filter(({ pathname, uploadedAt }) => {
      const uploadedAtMs = new Date(uploadedAt).getTime();
      return (
        isManagedBackupPathname(pathname) &&
        Number.isFinite(uploadedAtMs) &&
        uploadedAtMs < cutoff
      );
    })
    .map(({ pathname }) => pathname);
}

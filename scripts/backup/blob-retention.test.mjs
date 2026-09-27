import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredBackupPathnames } from './blob-retention.mjs';

test('expires only matching backups older than 30 days', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  const blobs = [
    {
      pathname: 'health-record/supabase/supabase-20260828T115959Z-123456789abc.tar.gz.age',
      uploadedAt: new Date('2026-08-28T11:59:59.999Z'),
    },
    {
      pathname: 'health-record/supabase/supabase-20260828T120000Z-123456789abc.tar.gz.age',
      uploadedAt: new Date('2026-08-28T12:00:00.000Z'),
    },
    {
      pathname: 'health-record/supabase/supabase-20260829T120000Z-123456789abc.tar.gz.age',
      uploadedAt: new Date('2026-08-29T12:00:00.000Z'),
    },
    {
      pathname: 'other-project/backup.tar.gz.age',
      uploadedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    {
      pathname: 'health-record/supabase/not-a-backup.txt',
      uploadedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  ];

  assert.deepEqual(expiredBackupPathnames(blobs, now), [blobs[0].pathname]);
});

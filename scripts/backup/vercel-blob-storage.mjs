import { del, get, list, put } from '@vercel/blob';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isManagedBackupPathname, expiredBackupPathnames } from './blob-retention.mjs';

const BACKUP_PREFIX = 'health-record/supabase/';
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');
  return token;
}

function requireBackupPathname(pathname) {
  if (!isManagedBackupPathname(pathname)) {
    throw new Error('backup pathname is invalid');
  }
}

function requireOutsideRepository(pathname) {
  const resolved = resolve(pathname);
  const relativePath = relative(REPOSITORY_ROOT, resolved);
  if (relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..')) {
    throw new Error('backup files must stay outside the public repository');
  }
  return resolved;
}

async function listBackups(token) {
  const blobs = [];
  let cursor;

  do {
    const page = await list({ token, prefix: BACKUP_PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    if (!page.hasMore) break;
    if (!page.cursor || page.cursor === cursor) throw new Error('Blob listing pagination failed');
    cursor = page.cursor;
  } while (true);

  return blobs;
}

async function uploadBackup(filePath, pathname) {
  const token = requireToken();
  requireBackupPathname(pathname);
  if (basename(filePath) !== basename(pathname)) {
    throw new Error('backup filename and Blob pathname must match');
  }

  const fileSize = (await stat(filePath)).size;
  const uploaded = await put(pathname, Readable.toWeb(createReadStream(filePath)), {
    access: 'private',
    contentType: 'application/octet-stream',
    token,
  });

  const blobs = await listBackups(token);
  const verified = blobs.find((blob) => blob.pathname === uploaded.pathname);
  if (!verified || verified.size !== fileSize) {
    throw new Error('uploaded backup size verification failed');
  }

  const expired = expiredBackupPathnames(blobs);
  if (expired.length > 0) await del(expired, { token });

  process.stdout.write(`Uploaded and verified encrypted backup (${fileSize} bytes); removed ${expired.length} expired backups.\n`);
}

async function downloadBackup(pathname, outputPath) {
  const token = requireToken();
  requireBackupPathname(pathname);
  const destination = requireOutsideRepository(outputPath);
  const blob = await get(pathname, { access: 'private', token, useCache: false });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new Error('backup was not found in the private Blob store');
  }

  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  let created = false;
  const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
  output.once('open', () => {
    created = true;
  });
  try {
    await pipeline(Readable.fromWeb(blob.stream), output);
    if ((await stat(destination)).size !== blob.blob.size) {
      throw new Error('downloaded backup size verification failed');
    }
  } catch (error) {
    if (created) await unlink(destination).catch(() => {});
    throw error;
  }

  process.stdout.write(`Downloaded encrypted backup (${blob.blob.size} bytes).\n`);
}

async function main(args) {
  if (args[0] === 'upload' && args.length === 3) {
    await uploadBackup(args[1], args[2]);
    return;
  }
  if (args[0] === 'download' && args.length === 3) {
    await downloadBackup(args[1], args[2]);
    return;
  }
  throw new Error(
    'usage: vercel-blob-storage.mjs upload ARCHIVE PATHNAME | download PATHNAME OUTPUT_PATH',
  );
}

main(process.argv.slice(2)).catch((error) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`vercel-blob-storage: ${token ? message.replaceAll(token, '[redacted]') : message}\n`);
  process.exitCode = 1;
});

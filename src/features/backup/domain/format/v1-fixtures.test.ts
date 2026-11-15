import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MemoryFile } from '../../testing/in-memory-zip-files';
import { decodeUtf8Strict } from '../utf8';
import { openStoredArchive, readVerifiedEntry } from '../zip/archive';
import { BACKUP_ZIP_LIMITS } from '../zip/format';
import { backupManifestV1Schema, manifestEnvelopeSchema } from './manifest';
import { checkIntegrity, checkPhotoFiles } from './integrity';
import { readBackupData } from './read-backup-data';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const load = (name: string) =>
  new MemoryFile(new Uint8Array(readFileSync(join(__dirname, '__fixtures__', 'v1', name))));

type Outcome = { readonly code: string; readonly detail?: unknown } | 'ok';

/** Recorre los pasos de lectura de ADR-012 sobre un fixture, sin escribir nada. */
async function inspect(name: string): Promise<Outcome> {
  const file = load(name);
  const archive = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
  if (!archive.ok) {
    return { code: 'invalid_archive', detail: archive.error };
  }
  const manifestEntry = archive.value.entries.get('manifest.json');
  const manifestBytes = manifestEntry && (await readVerifiedEntry(file, manifestEntry));
  if (!manifestBytes?.ok) {
    return { code: 'not_a_backup' };
  }
  const text = decodeUtf8Strict(manifestBytes.value);
  const json: unknown = text.ok ? JSON.parse(text.value) : null;
  const envelope = manifestEnvelopeSchema.safeParse(json);
  if (!envelope.success || envelope.data.format !== 'cuantovendi-backup') {
    return { code: 'not_a_backup' };
  }
  if (envelope.data.formatVersion > 1) {
    return { code: 'newer_format' };
  }
  const manifest = backupManifestV1Schema.parse(json);
  const dataEntry = archive.value.entries.get('data.json');
  const dataBytes = dataEntry && (await readVerifiedEntry(file, dataEntry));
  if (!dataBytes?.ok) {
    return { code: 'invalid_archive' };
  }
  const declared = manifest.files.find((entry) => entry.path === 'data.json');
  if (declared?.sha256 !== sha256(dataBytes.value)) {
    return { code: 'checksum_mismatch', detail: 'data.json' };
  }
  const decoded = decodeUtf8Strict(dataBytes.value);
  const data = readBackupData(1, decoded.ok ? JSON.parse(decoded.value) : null);
  if (!data.ok) {
    return { code: data.error.code };
  }
  const integrity = checkIntegrity(data.value, manifest);
  const photos = checkPhotoFiles(data.value, manifest);
  if (!integrity.ok || !photos.ok) {
    return { code: 'integrity' };
  }
  return 'ok';
}

describe('frozen v1 fixtures', () => {
  test('valid.zip passes every step, including photo hashes and PK signatures inside the photo', async () => {
    expect(await inspect('valid.zip')).toBe('ok');
    const file = load('valid.zip');
    const archive = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    const photo = [...(archive.ok ? archive.value.entries.values() : [])].find((entry) =>
      entry.path.startsWith('photos/'),
    );
    expect(photo).toBeDefined();
    if (photo !== undefined) {
      const bytes = await readVerifiedEntry(file, photo);
      expect(bytes.ok && sha256(bytes.value)).toBe(
        backupManifestOf(await manifestJson(file, archive)).files.find((f) => f.path === photo.path)
          ?.sha256,
      );
    }
  });

  test('tampered.zip has a valid CRC but a data.json that does not match the manifest sha256', async () => {
    expect(await inspect('tampered.zip')).toEqual({
      code: 'checksum_mismatch',
      detail: 'data.json',
    });
  });

  test('future-format.zip is reported as a newer format', async () => {
    expect(await inspect('future-format.zip')).toEqual({ code: 'newer_format' });
  });
});

async function manifestJson(
  file: MemoryFile,
  archive: Awaited<ReturnType<typeof openStoredArchive>>,
): Promise<unknown> {
  const entry = archive.ok ? archive.value.entries.get('manifest.json') : undefined;
  const bytes = entry && (await readVerifiedEntry(file, entry));
  const text = bytes?.ok ? decodeUtf8Strict(bytes.value) : null;
  return text?.ok ? JSON.parse(text.value) : null;
}

function backupManifestOf(json: unknown) {
  return backupManifestV1Schema.parse(json);
}

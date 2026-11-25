import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import {
  epochMsSchema,
  localDateSchema,
  productPhotoIdSchema,
  type LocalCalendar,
} from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import {
  BACKUP_ZIP_LIMITS,
  decodeUtf8Strict,
  openStoredArchive,
  type DatabaseCopier,
} from '../domain';
import { FREE_SPACE_MARGIN_BYTES } from '../domain/space';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { FakeFileSharer } from '../testing/fake-file-sharer';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { testId } from '../testing/snapshot-fixtures';
import { exportEmergency, type EmergencyExportDeps } from './export-emergency';

const NOW = epochMsSchema.parse(Date.parse('2026-11-13T23:50:00Z'));
const DIRECTORY = 'file:///fake/cache/emergency/';
const ZIP_URI = `${DIRECTORY}kofi-emergencia-2026-11-14.zip`;
const DB_URI = `${DIRECTORY}cuantovendi-1.db`;
const DB_BYTES = Uint8Array.from({ length: 5000 }, (_, index) => (index * 11) % 253);
const PHOTO_BYTES = Uint8Array.from({ length: 700 }, (_, index) => (index * 5) % 241);
const photoId = (n: number) => productPhotoIdSchema.parse(testId(3, n));

const calendar: LocalCalendar = {
  localDateOf: () => localDateSchema.parse('2026-11-14'),
  instantAt: () => NOW,
  nextLocalMidnight: () => NOW,
};

interface CopierCall {
  readonly directoryUri: string;
}

function setUp(options: { dbBytes?: Uint8Array; mode?: 'backup_api' | 'raw_files' } = {}) {
  const io = new InMemoryArchiveIo();
  const photos = new InMemoryPhotoStorage();
  const sharer = new FakeFileSharer();
  const logger = new RecordingLogger();
  const calls: CopierCall[] = [];
  const backupFiles = new FakeBackupFiles();
  const files = [{ uri: DB_URI, entryName: 'cuantovendi.db' }];
  const copier: DatabaseCopier = {
    copyTo: (directoryUri) => {
      calls.push({ directoryUri });
      backupFiles.events.push('copy');
      io.put(DB_URI, options.dbBytes ?? DB_BYTES);
      return Promise.resolve({ mode: options.mode ?? 'backup_api', files });
    },
  };
  photos.addFile(photoId(2), NOW);
  io.put(photos.uriFor(photoId(2)), PHOTO_BYTES);
  photos.addFile(photoId(1), NOW);
  io.put(photos.uriFor(photoId(1)), PHOTO_BYTES);
  const deps: EmergencyExportDeps = {
    copier,
    photos,
    archiveIo: io,
    backupFiles,
    fileSharer: sharer,
    clock: new FakeClock(NOW),
    calendar,
    logger,
    appVersion: '1.2.3',
  };
  return { deps, io, photos, sharer, logger, calls, copier, backupFiles };
}

function decodeJson(bytes: Uint8Array): unknown {
  const decoded = decodeUtf8Strict(bytes);
  if (!decoded.ok) {
    throw new Error('The bytes are not valid UTF-8.');
  }
  return JSON.parse(decoded.value);
}

async function openZip(io: InMemoryArchiveIo) {
  const file = await io.openForRead(ZIP_URI);
  return { file, opened: await openStoredArchive(file, BACKUP_ZIP_LIMITS) };
}

describe('exportEmergency', () => {
  it('packages info.json, the database copy and the photos, and shares the ZIP', async () => {
    const { deps, io, sharer, calls } = setUp();

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([{ directoryUri: DIRECTORY }]);
    expect(sharer.shared).toEqual([
      { fileUri: ZIP_URI, mimeType: 'application/zip', uti: 'public.zip-archive' },
    ]);
    expect(io.files.get(ZIP_URI)).toBeDefined();
  });

  it('writes the entries with the right bytes (read with the permissive entry limits)', async () => {
    const { deps, io } = setUp();
    await exportEmergency(deps, 'foreign_key_violation');
    const entries = scanLocalEntries(io.files.get(ZIP_URI) ?? new Uint8Array(0));

    expect([...entries.keys()]).toEqual([
      'info.json',
      'cuantovendi.db',
      `photos/${photoId(1)}.jpg`,
      `photos/${photoId(2)}.jpg`,
    ]);
    expect(entries.get('cuantovendi.db')).toEqual(DB_BYTES);
    expect(entries.get(`photos/${photoId(1)}.jpg`)).toEqual(PHOTO_BYTES);
    expect(decodeJson(entries.get('info.json') ?? new Uint8Array(0))).toEqual({
      kind: 'cuantovendi-emergency',
      createdAt: '2026-11-13T23:50:00.000Z',
      appVersion: '1.2.3',
      reason: 'foreign_key_violation',
      mode: 'backup_api',
    });
  });

  it('includes the wal and shm copies in raw mode', async () => {
    const { deps, io, copier } = setUp({ mode: 'raw_files' });
    const files = [
      { uri: DB_URI, entryName: 'cuantovendi.db' },
      { uri: `${DB_URI}-wal`, entryName: 'cuantovendi.db-wal' },
      { uri: `${DB_URI}-shm`, entryName: 'cuantovendi.db-shm' },
    ];
    io.put(`${DB_URI}-wal`, Uint8Array.of(1, 2));
    io.put(`${DB_URI}-shm`, Uint8Array.of(3));
    const rawDeps: EmergencyExportDeps = {
      ...deps,
      copier: { copyTo: async (dir) => ({ ...(await copier.copyTo(dir)), files }) },
    };

    await exportEmergency(rawDeps, 'newer_database');

    const entries = scanLocalEntries(io.files.get(ZIP_URI) ?? new Uint8Array(0));
    expect([...entries.keys()].slice(0, 4)).toEqual([
      'info.json',
      'cuantovendi.db',
      'cuantovendi.db-wal',
      'cuantovendi.db-shm',
    ]);
    expect(decodeJson(entries.get('info.json') ?? new Uint8Array(0))).toMatchObject({
      mode: 'raw_files',
      reason: 'newer_database',
    });
  });

  it('never calls the copier with anything but the emergency folder and does not touch the source files', async () => {
    const { deps, io, calls } = setUp();
    const before = new Map(io.files);

    await exportEmergency(deps, 'migration_failed');

    expect(calls.map((call) => call.directoryUri)).toEqual([DIRECTORY]);
    for (const [uri, bytes] of before) {
      expect(io.files.get(uri)).toEqual(bytes);
    }
    expect(io.created).toEqual([ZIP_URI]);
  });

  it('writes a database larger than the entry limit in two passes by blocks', async () => {
    const size = BACKUP_ZIP_LIMITS.maxEntryBytes + 1_500_000;
    const { deps, io } = setUp({ dbBytes: new Uint8Array(size) });

    await exportEmergency(deps, 'migration_failed');

    const blocks = Math.ceil(size / 1_048_576);
    const dbReads = io.readers
      .filter((reader) => reader.size === size)
      .flatMap((reader) => reader.reads);
    expect(dbReads).toHaveLength(blocks * 2);
    expect(io.allClosed()).toBe(true);
  });

  it('produces a ZIP that the restore reader rejects with invalid_name', async () => {
    const { deps, io } = setUp();
    await exportEmergency(deps, 'migration_failed');

    const { file, opened } = await openZip(io);

    expect(opened).toEqual({ ok: false, error: 'invalid_name' });
    file.close();
  });

  it('reports sharing_unavailable before copying anything', async () => {
    const { deps, sharer, calls } = setUp();
    sharer.available = false;

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result).toEqual({ ok: false, error: { code: 'sharing_unavailable' } });
    expect(calls).toEqual([]);
  });

  it('reports database_unavailable when the copy fails and logs the cause', async () => {
    const { deps, logger, sharer, io } = setUp();
    const failing: EmergencyExportDeps = {
      ...deps,
      copier: { copyTo: () => Promise.reject(new Error('no database')) },
    };

    const result = await exportEmergency(failing, 'migration_failed');

    expect(result).toEqual({ ok: false, error: { code: 'database_unavailable' } });
    expect(logger.entriesAt('error').map((entry) => entry.event)).toEqual([
      'emergency_export_copy_failed',
    ]);
    expect(sharer.shared).toEqual([]);
    expect(io.created).toEqual([]);
  });

  it('fails with not_enough_space before writing the ZIP', async () => {
    const { deps, io, sharer } = setUp();
    io.freeSpace = FREE_SPACE_MARGIN_BYTES;

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ code: 'not_enough_space' });
    }
    expect(io.created).toEqual([]);
    expect(sharer.shared).toEqual([]);
  });

  it('empties the emergency folder before copying the database', async () => {
    const { deps, backupFiles } = setUp();

    await exportEmergency(deps, 'migration_failed');

    expect(backupFiles.events.slice(0, 2)).toEqual(['clear', 'copy']);
    expect(backupFiles.clearedEmergency).toBe(1);
  });

  it('deletes the database copies after writing the ZIP, but not the ZIP', async () => {
    const { deps, backupFiles, sharer } = setUp();

    await exportEmergency(deps, 'migration_failed');

    expect(backupFiles.discarded).toEqual([DB_URI]);
    expect(backupFiles.events.at(-1)).toBe(`discard:${DB_URI}`);
    expect(sharer.shared).toHaveLength(1);
  });

  it('deletes every copy of a raw-mode database', async () => {
    const { deps, io, copier, backupFiles } = setUp({ mode: 'raw_files' });
    const files = [
      { uri: DB_URI, entryName: 'cuantovendi.db' },
      { uri: `${DB_URI}-wal`, entryName: 'cuantovendi.db-wal' },
    ];
    io.put(`${DB_URI}-wal`, Uint8Array.of(1, 2));

    await exportEmergency(
      { ...deps, copier: { copyTo: async (dir) => ({ ...(await copier.copyTo(dir)), files }) } },
      'newer_database',
    );

    expect(backupFiles.discarded).toEqual([DB_URI, `${DB_URI}-wal`]);
  });

  it('deletes the copies when there is not enough space after copying', async () => {
    const { deps, io, backupFiles } = setUp();
    io.freeSpace = FREE_SPACE_MARGIN_BYTES + 3_500;

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result.ok).toBe(false);
    expect(backupFiles.discarded).toEqual([DB_URI]);
  });

  it('deletes the copies when writing the ZIP or sharing it fails', async () => {
    const { deps, io, sharer, backupFiles } = setUp();
    io.failWriteAtCall = 1;

    await expect(exportEmergency(deps, 'migration_failed')).rejects.toThrow();
    expect(backupFiles.discarded).toEqual([DB_URI]);

    io.failWriteAtCall = null;
    jest.spyOn(sharer, 'share').mockRejectedValue(new Error('share failed'));
    await expect(exportEmergency(deps, 'migration_failed')).rejects.toThrow('share failed');
    expect(backupFiles.discarded).toEqual([DB_URI, DB_URI]);
  });

  it('measures the free space before copying the database', async () => {
    const { deps, io, calls, backupFiles } = setUp();
    io.freeSpace = FREE_SPACE_MARGIN_BYTES;

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ code: 'not_enough_space' });
    }
    expect(calls).toEqual([]);
    expect(backupFiles.discarded).toEqual([]);
  });

  it('works without photos', async () => {
    const { deps, io, photos } = setUp();
    for (const file of await photos.listFiles()) {
      await photos.remove(file.id);
    }

    const result = await exportEmergency(deps, 'migration_failed');

    expect(result.ok).toBe(true);
    expect(io.files.get(ZIP_URI)).toBeDefined();
  });
});

function scanLocalEntries(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= zip.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const dataStart = offset + 30 + nameLength;
    const name = new TextDecoder().decode(zip.slice(offset + 30, dataStart));
    entries.set(name, zip.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

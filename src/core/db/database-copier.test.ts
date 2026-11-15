import { backupDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import type { AppDatabaseHandle } from './client';
import { createDatabaseCopier } from './database-copier';

const mockFiles = new Map<string, string>();
const mockCopies: { from: string; to: string; overwrite: boolean | undefined }[] = [];

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/data/files/SQLite',
  openDatabaseAsync: jest.fn(),
  backupDatabaseAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  File: class MockFile {
    readonly uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .reduce((joined, part) => `${joined.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}`);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    copy(destination: { uri: string }, options?: { overwrite?: boolean }) {
      mockCopies.push({ from: this.uri, to: destination.uri, overwrite: options?.overwrite });
      return Promise.resolve();
    }
  },
}));

const DIRECTORY = 'file:///data/cache/emergency/';
const INSTANT = epochMsSchema.parse(1_800_000_000_123);
const NATIVE = { kind: 'native' } as never;

interface MockDestination {
  closeAsync: jest.Mock<Promise<void>, []>;
}

function setUp(getHandle: () => AppDatabaseHandle) {
  const logger = new RecordingLogger();
  const copier = createDatabaseCopier({ getHandle, clock: new FakeClock(INSTANT), logger });
  return { copier, logger };
}

const healthy = (): AppDatabaseHandle => ({ native: NATIVE }) as unknown as AppDatabaseHandle;

describe('createDatabaseCopier', () => {
  let destination: MockDestination;

  beforeEach(() => {
    mockFiles.clear();
    mockCopies.length = 0;
    destination = { closeAsync: jest.fn(() => Promise.resolve()) };
    jest.mocked(openDatabaseAsync).mockResolvedValue(destination as never);
    jest.mocked(backupDatabaseAsync).mockResolvedValue(undefined);
  });

  it('copies with the backup API from the open database into a new .db and closes the target', async () => {
    const { copier } = setUp(healthy);

    const result = await copier.copyTo(DIRECTORY);

    expect(openDatabaseAsync).toHaveBeenCalledWith(
      'cuantovendi-1800000000123.db',
      {},
      '/data/cache/emergency',
    );
    expect(backupDatabaseAsync).toHaveBeenCalledWith({
      sourceDatabase: NATIVE,
      destDatabase: destination,
    });
    expect(destination.closeAsync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      mode: 'backup_api',
      files: [{ uri: `${DIRECTORY}cuantovendi-1800000000123.db`, entryName: 'cuantovendi.db' }],
    });
    expect(mockCopies).toEqual([]);
  });

  it('closes the target and falls back to the raw files when the backup fails', async () => {
    jest.mocked(backupDatabaseAsync).mockRejectedValue(new Error('disk I/O error'));
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db', 'db');
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db-wal', 'wal');
    const { copier, logger } = setUp(healthy);

    const result = await copier.copyTo(DIRECTORY);

    expect(destination.closeAsync).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('raw_files');
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toContain(
      'emergency_backup_api_failed',
    );
  });

  it('copies the raw database, wal and shm files when the database cannot be opened', async () => {
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db', 'db');
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db-wal', 'wal');
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db-shm', 'shm');
    const { copier } = setUp(() => {
      throw new Error('cannot open');
    });

    const result = await copier.copyTo(DIRECTORY);

    expect(backupDatabaseAsync).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: 'raw_files',
      files: [
        { uri: `${DIRECTORY}cuantovendi-1800000000123.db`, entryName: 'cuantovendi.db' },
        { uri: `${DIRECTORY}cuantovendi-1800000000123.db-wal`, entryName: 'cuantovendi.db-wal' },
        { uri: `${DIRECTORY}cuantovendi-1800000000123.db-shm`, entryName: 'cuantovendi.db-shm' },
      ],
    });
    expect(mockCopies).toEqual([
      {
        from: 'file:///data/files/SQLite/cuantovendi.db',
        to: `${DIRECTORY}cuantovendi-1800000000123.db`,
        overwrite: true,
      },
      {
        from: 'file:///data/files/SQLite/cuantovendi.db-wal',
        to: `${DIRECTORY}cuantovendi-1800000000123.db-wal`,
        overwrite: true,
      },
      {
        from: 'file:///data/files/SQLite/cuantovendi.db-shm',
        to: `${DIRECTORY}cuantovendi-1800000000123.db-shm`,
        overwrite: true,
      },
    ]);
  });

  it('skips the wal and shm files that do not exist', async () => {
    mockFiles.set('file:///data/files/SQLite/cuantovendi.db', 'db');
    const { copier } = setUp(() => {
      throw new Error('cannot open');
    });

    const result = await copier.copyTo(DIRECTORY);

    expect(result.files.map((file) => file.entryName)).toEqual(['cuantovendi.db']);
  });

  it('fails when there is no database file to copy', async () => {
    const { copier } = setUp(() => {
      throw new Error('cannot open');
    });

    await expect(copier.copyTo(DIRECTORY)).rejects.toThrow();
  });
});

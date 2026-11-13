import type { MigrationBundle } from '@/core/db/configure-and-migrate';
import { ok } from '@/shared/domain/result';

import { createAppDependencies } from './create-app-dependencies';

const mockOpenAppDatabase = jest.fn();
const mockConfigureAndMigrate = jest.fn();
const mockCreateRunInTransaction = jest.fn();
const mockCreateTransactionRunner = jest.fn();
const mockCreateDrizzleProductRepository = jest.fn();
const mockCollectOrphanPhotos = jest.fn();
const mockSweepStaleCacheFiles = jest.fn();

const mockBundle: MigrationBundle = { journal: { entries: [] }, migrations: {} };
const mockHandle = { raw: { exec: jest.fn(), pragmaValue: jest.fn() }, db: {} };

jest.mock('@/core/db/client', () => ({
  openAppDatabase: (): unknown => mockOpenAppDatabase(),
}));
jest.mock('@/core/db/configure-and-migrate', () => ({
  configureAndMigrate: (...args: unknown[]): unknown => mockConfigureAndMigrate(...args),
}));
jest.mock('@/core/db/transaction', () => ({
  createRunInTransaction: (...args: unknown[]): unknown => mockCreateRunInTransaction(...args),
  createTransactionRunner: (...args: unknown[]): unknown => mockCreateTransactionRunner(...args),
}));
jest.mock('@/features/products/data/drizzle-product-repository', () => ({
  createDrizzleProductRepository: (...args: unknown[]): unknown =>
    mockCreateDrizzleProductRepository(...args),
}));
jest.mock('@/features/products', () => ({
  collectOrphanPhotos: (...args: unknown[]): unknown => mockCollectOrphanPhotos(...args),
  sweepStaleCacheFiles: (...args: unknown[]): unknown => mockSweepStaleCacheFiles(...args),
  ORPHAN_MIN_AGE_MS: 900_000,
  createExpoPhotoStorage: () => ({ uriFor: jest.fn() }),
  createExpoPhotoPicker: () => ({ takePhoto: jest.fn() }),
}));
jest.mock('@/core/db/migrations/migrations', () => ({
  __esModule: true,
  get default(): MigrationBundle {
    return mockBundle;
  },
}));
jest.mock('expo-crypto', () => ({ getRandomBytes: (length: number) => new Uint8Array(length) }));

describe('createAppDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSweepStaleCacheFiles.mockReset();
    mockOpenAppDatabase.mockReturnValue(mockHandle);
    mockConfigureAndMigrate.mockResolvedValue(ok(undefined));
    mockCreateRunInTransaction.mockReturnValue('run-in-transaction');
    mockCreateTransactionRunner.mockReturnValue({ run: jest.fn().mockResolvedValue('done') });
    mockCreateDrizzleProductRepository.mockReturnValue({ kind: 'product-store' });
  });

  test('builds the real adapters without opening the database', () => {
    const { dependencies } = createAppDependencies();

    expect(dependencies.clock.now()).toBeGreaterThan(0);
    expect(dependencies.calendar.localDateOf(dependencies.clock.now())).toMatch(/^\d{4}-/);
    expect(dependencies.ids.next()).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof dependencies.logger.info).toBe('function');
    expect(typeof dependencies.dataChanges.subscribe).toBe('function');
    expect(mockOpenAppDatabase).not.toHaveBeenCalled();
  });

  test('migrateDatabase opens the database and migrates it with the bundled migrations', async () => {
    const { migrateDatabase } = createAppDependencies();

    const result = await migrateDatabase();

    expect(result).toEqual(ok(undefined));
    expect(mockConfigureAndMigrate).toHaveBeenCalledWith(mockHandle.raw, mockHandle.db, mockBundle);
  });

  test('migrateDatabase rejects instead of throwing when the database cannot be opened', async () => {
    mockOpenAppDatabase.mockImplementation(() => {
      throw new Error('open failed');
    });
    const { migrateDatabase } = createAppDependencies();

    const migration = migrateDatabase();

    await expect(migration).rejects.toThrow('open failed');
  });

  test('shares one connection between the migration and the transactions', async () => {
    const { dependencies, migrateDatabase } = createAppDependencies();

    await migrateDatabase();
    await expect(dependencies.transactions.run(() => 1)).resolves.toBe('done');

    await dependencies.transactions.run(() => 2);
    expect(mockOpenAppDatabase).toHaveBeenCalledTimes(1);
    expect(mockCreateRunInTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransactionRunner).toHaveBeenCalledWith('run-in-transaction');
    expect(mockCreateRunInTransaction).toHaveBeenCalledWith(
      mockHandle.db,
      dependencies.dataChanges,
    );
  });

  describe('photos', () => {
    test('exposes the photo storage, the picker and one file lock', () => {
      const { dependencies } = createAppDependencies();

      expect(typeof dependencies.photos.uriFor).toBe('function');
      expect(typeof dependencies.photoPicker.takePhoto).toBe('function');
      expect(dependencies.fileLock.isHeld()).toBe(false);
    });

    test('runAfterFirstRender collects the orphans with the shared lock and the product store', async () => {
      mockCollectOrphanPhotos.mockResolvedValue({ kind: 'done' });
      const { dependencies, runAfterFirstRender } = createAppDependencies();

      await runAfterFirstRender();

      expect(mockCollectOrphanPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: dependencies.photos,
          products: dependencies.products,
          fileLock: dependencies.fileLock,
          logger: dependencies.logger,
        }),
      );
    });
  });

  describe('stale picker cache', () => {
    test('runAfterFirstRender sweeps the picker and manipulator cache with the 15 minute rule', async () => {
      mockCollectOrphanPhotos.mockResolvedValue({ kind: 'done' });
      const { dependencies, runAfterFirstRender } = createAppDependencies();

      await runAfterFirstRender();

      expect(mockSweepStaleCacheFiles).toHaveBeenCalledWith(dependencies.logger, {
        now: expect.any(Number) as number,
        minAgeMs: 900_000,
      });
    });

    test('still collects the orphans when the sweep fails', async () => {
      mockCollectOrphanPhotos.mockResolvedValue({ kind: 'done' });
      mockSweepStaleCacheFiles.mockImplementation(() => {
        throw new Error('cache unreadable');
      });
      const { runAfterFirstRender } = createAppDependencies();

      await expect(runAfterFirstRender()).resolves.toBeUndefined();

      expect(mockCollectOrphanPhotos).toHaveBeenCalledTimes(1);
    });
  });

  describe('products', () => {
    interface CapturedAccess {
      readonly db: () => unknown;
      readonly runInTransaction: (work: (tx: unknown) => unknown) => unknown;
    }

    function capturedAccess(): CapturedAccess {
      expect(mockCreateDrizzleProductRepository).toHaveBeenCalledTimes(1);
      const [access] =
        (mockCreateDrizzleProductRepository.mock.calls as [CapturedAccess][])[0] ?? [];
      if (access === undefined) {
        throw new Error('The repository was not created.');
      }
      return access;
    }

    test('exposes one Drizzle repository as both the repository and the writer', () => {
      const { dependencies } = createAppDependencies();

      expect(dependencies.products).toEqual({ kind: 'product-store' });
      expect(dependencies.productWriter).toBe(dependencies.products);
    });

    test('builds the repository without opening the database', () => {
      createAppDependencies();

      expect(capturedAccess()).toBeDefined();
      expect(mockOpenAppDatabase).not.toHaveBeenCalled();
      expect(mockCreateRunInTransaction).not.toHaveBeenCalled();
    });

    test('gives the repository the same connection as the migration', () => {
      createAppDependencies();

      expect(capturedAccess().db()).toBe(mockHandle.db);
      expect(mockOpenAppDatabase).toHaveBeenCalledTimes(1);
    });

    test('shares one runInTransaction between the repository and the transaction runner', async () => {
      const runInTransaction = jest.fn((work: (tx: unknown) => unknown) => work('tx'));
      mockCreateRunInTransaction.mockReturnValue(runInTransaction);
      const { dependencies } = createAppDependencies();

      const fromRepository = capturedAccess().runInTransaction((tx) => tx);
      await dependencies.transactions.run(() => 1);

      expect(fromRepository).toBe('tx');
      expect(runInTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateRunInTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateTransactionRunner).toHaveBeenCalledWith(runInTransaction);
    });
  });
});

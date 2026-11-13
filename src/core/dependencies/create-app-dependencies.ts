import { openAppDatabase, type AppDatabaseHandle } from '@/core/db/client';
import { configureAndMigrate } from '@/core/db/configure-and-migrate';
import { createDataChanges } from '@/core/db/data-changes';
import migrations from '@/core/db/migrations/migrations';
import {
  createRunInTransaction,
  createTransactionRunner,
  type RunInTransaction,
} from '@/core/db/transaction';
import { createFileLock } from '@/core/files/file-lock';
import type { AppComposition } from '@/core/providers/app-dependencies';
import {
  ORPHAN_MIN_AGE_MS,
  collectOrphanPhotos,
  createExpoPhotoPicker,
  createExpoPhotoStorage,
  sweepStaleCacheFiles,
} from '@/features/products';
import { createDrizzleProductRepository } from '@/features/products/data/drizzle-product-repository';
import { createDrizzleNoSalesWeekRepository } from '@/features/sales/data/drizzle-no-sales-week-repository';
import { createDrizzleSaleRepository } from '@/features/sales/data/drizzle-sale-repository';
import { systemClock } from '@/shared/domain/calendar/clock';
import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import { createLogger } from '@/shared/lib/logger';

import { createDeviceIdGenerator } from './device-id-generator';

/** Crea el valor la primera vez que se pide y lo reutiliza después. */
function once<T>(create: () => T): () => T {
  let created: { readonly value: T } | undefined;
  return () => {
    created ??= { value: create() };
    return created.value;
  };
}

/**
 * Única fábrica de implementaciones concretas (ADR-005). Construye las dependencias reales
 * de F0 sin abrir la base: la conexión se abre la primera vez que `migrateDatabase` o una
 * transacción la necesita, y se comparte entre ambas. `getRunInTransaction` es la única
 * instancia de `runInTransaction`: el `TransactionRunner` y los repositorios de Drizzle que
 * se construyan aquí deben usarla, para que la anidación y los avisos de `DataChanges`
 * funcionen sobre la misma transacción activa.
 */
export function createAppDependencies(): AppComposition {
  const logger = createLogger();
  const dataChanges = createDataChanges(logger);
  const getDatabase = once<AppDatabaseHandle>(openAppDatabase);
  const getRunInTransaction = once<RunInTransaction>(() =>
    createRunInTransaction(getDatabase().db, dataChanges),
  );
  const getRunner = once<TransactionRunner>(() => createTransactionRunner(getRunInTransaction()));
  const runInTransaction: RunInTransaction = (work) => getRunInTransaction()(work);
  const productStore = createDrizzleProductRepository({
    db: () => getDatabase().db,
    runInTransaction,
  });
  const salesAccess = { db: () => getDatabase().db, runInTransaction };
  const saleStore = createDrizzleSaleRepository(salesAccess);
  const noSalesStore = createDrizzleNoSalesWeekRepository(salesAccess);

  const photos = createExpoPhotoStorage(logger);
  const fileLock = createFileLock();

  return {
    dependencies: {
      clock: systemClock,
      calendar: deviceLocalCalendar,
      ids: createDeviceIdGenerator(systemClock),
      logger,
      dataChanges,
      transactions: { run: (work) => getRunner().run(work) },
      products: productStore,
      productWriter: productStore,
      sales: saleStore,
      saleWriter: saleStore,
      noSalesWeeks: noSalesStore,
      noSalesWeekWriter: noSalesStore,
      photos,
      photoPicker: createExpoPhotoPicker(logger),
      fileLock,
    },
    migrateDatabase: async () => {
      const { raw, db } = getDatabase();
      return configureAndMigrate(raw, db, migrations);
    },
    runAfterFirstRender: async () => {
      try {
        sweepStaleCacheFiles(logger, { now: systemClock.now(), minAgeMs: ORPHAN_MIN_AGE_MS });
      } catch (error) {
        logger.error('picker_cache_sweep_failed', error);
      }
      await collectOrphanPhotos({
        photos,
        products: productStore,
        fileLock,
        clock: systemClock,
        logger,
      });
    },
  };
}

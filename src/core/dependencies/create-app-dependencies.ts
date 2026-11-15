import { openAppDatabase, type AppDatabaseHandle } from '@/core/db/client';
import { configureAndMigrate } from '@/core/db/configure-and-migrate';
import { createDataChanges } from '@/core/db/data-changes';
import { createDatabaseCopier } from '@/core/db/database-copier';
import migrations from '@/core/db/migrations/migrations';
import {
  createRunInTransaction,
  createTransactionRunner,
  type RunInTransaction,
} from '@/core/db/transaction';
import { createFileLock } from '@/core/files/file-lock';
import type { AppComposition } from '@/core/providers/app-dependencies';
import {
  cleanupBackupTemporaries,
  createExpoArchiveIo,
  createExpoBackupFiles,
  createExpoDocumentPicker,
  createExpoFileSharer,
  exportEmergency,
} from '@/features/backup';
import {
  ORPHAN_MIN_AGE_MS,
  collectOrphanPhotos,
  createExpoPhotoPicker,
  createExpoPhotoStorage,
  sweepStaleCacheFiles,
} from '@/features/products';
import { createDrizzleBackupStore } from '@/features/backup/data/drizzle-backup-store';
import { createDrizzleProductRepository } from '@/features/products/data/drizzle-product-repository';
import { createDrizzleNoSalesWeekRepository } from '@/features/sales/data/drizzle-no-sales-week-repository';
import { createDrizzleSaleRepository } from '@/features/sales/data/drizzle-sale-repository';
import { createDrizzlePreferencesRepository } from '@/features/notifications/data/drizzle-preferences-repository';
import {
  createExpoNotificationResponses,
  createExpoNotificationScheduler,
  createNotificationReconciler,
  createRegisteredWeekReader,
  installNotificationPresentation,
  reconcileNotifications,
} from '@/features/notifications';
import { bundledTipCatalog } from '@/features/tips';
import { createDrizzleTipViewRepository } from '@/features/tips/data/drizzle-tip-view-repository';
import { systemClock } from '@/shared/domain/calendar/clock';
import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import { createLogger } from '@/shared/lib/logger';
import Constants from 'expo-constants';

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

  const tipViewStore = createDrizzleTipViewRepository({ ...salesAccess, logger });

  const preferencesStore = createDrizzlePreferencesRepository({ ...salesAccess, logger });

  const notifications = createExpoNotificationScheduler();
  const registeredWeeks = createRegisteredWeekReader({
    sales: saleStore,
    noSalesWeeks: noSalesStore,
  });
  const notificationReconciler = createNotificationReconciler(
    () =>
      reconcileNotifications({
        scheduler: notifications,
        preferences: preferencesStore,
        weeks: registeredWeeks,
        clock: systemClock,
        calendar: deviceLocalCalendar,
        logger,
      }),
    logger,
  );
  installNotificationPresentation();

  const photos = createExpoPhotoStorage(logger);
  const fileLock = createFileLock();
  const backupStore = createDrizzleBackupStore({ ...salesAccess, logger });
  const archiveIo = createExpoArchiveIo();
  const backupFiles = createExpoBackupFiles(logger);
  const fileSharer = createExpoFileSharer();
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const databaseCopier = createDatabaseCopier({
    getHandle: getDatabase,
    clock: systemClock,
    logger,
  });

  async function cleanupTemporaries(): Promise<void> {
    try {
      await cleanupBackupTemporaries({ backupFiles, fileLock, clock: systemClock, logger });
    } catch (error) {
      logger.error('backup_cleanup_failed', error);
    }
  }

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
      tipViews: tipViewStore,
      tipCatalog: bundledTipCatalog,
      preferences: preferencesStore,
      notifications,
      notificationReconciler,
      notificationResponses: createExpoNotificationResponses(),
      registeredWeeks,
      backupStore,
      archiveIo,
      backupFiles,
      fileSharer,
      documentPicker: createExpoDocumentPicker(),
      appVersion,
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
      try {
        await collectOrphanPhotos({
          photos,
          products: productStore,
          fileLock,
          clock: systemClock,
          logger,
        });
      } finally {
        await cleanupTemporaries();
      }
    },
    exportEmergency: (reason) =>
      exportEmergency(
        {
          copier: databaseCopier,
          photos,
          archiveIo,
          backupFiles,
          fileSharer,
          clock: systemClock,
          calendar: deviceLocalCalendar,
          logger,
          appVersion,
        },
        reason,
      ),
  };
}

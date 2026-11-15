import type { AppDependencies } from '@/core/providers/app-dependencies';
import { createDataChanges } from '@/core/db/data-changes';
import { createFileLock } from '@/core/files/file-lock';
import { FakeBackupFiles } from '@/features/backup/testing/fake-backup-files';
import { FakeDocumentPicker } from '@/features/backup/testing/fake-document-picker';
import { FakeFileSharer } from '@/features/backup/testing/fake-file-sharer';
import { InMemoryArchiveIo } from '@/features/backup/testing/in-memory-archive-io';
import { EMPTY_SNAPSHOT } from '@/features/backup/testing/snapshot-fixtures';
import {
  createInMemoryProductRepository,
  type InMemoryProductRepository,
} from '@/features/products/testing/in-memory-product-repository';
import { createInMemoryNoSalesWeekRepository } from '@/features/sales/testing/in-memory-no-sales-week-repository';
import {
  createInMemorySaleRepository,
  type InMemorySaleRepository,
} from '@/features/sales/testing/in-memory-sale-repository';
import type { NoSalesWeekRepository, NoSalesWeekWriter } from '@/features/sales';
import {
  createFakeNotificationResponses,
  type FakeNotificationResponses,
} from '@/features/notifications/testing/fake-notification-responses';
import {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from '@/features/notifications/testing/fake-notification-scheduler';
import { createInMemoryPreferencesRepository } from '@/features/notifications/testing/in-memory-preferences-repository';
import {
  createNotificationReconciler,
  createRegisteredWeekReader,
  reconcileNotifications,
} from '@/features/notifications';
import { createInMemoryTipViewRepository } from '@/features/tips/testing/in-memory-tip-view-repository';
import { createFixtureTipCatalog } from '@/features/tips/testing/fixture-tip-catalog';
import { FakePhotoPicker } from '@/features/products/testing/fake-photo-picker';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import { epochMsSchema } from '@/shared/domain/epoch-ms';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

const DEFAULT_TEST_INSTANT = Date.parse('2026-07-01T16:00:00Z');

/** `AppDependencies` de test, con los dobles concretos para poder inspeccionarlos. */
export interface TestDependencies extends AppDependencies {
  readonly clock: FakeClock;
  readonly ids: SequentialIdGenerator;
  readonly logger: RecordingLogger;
  readonly products: InMemoryProductRepository;
  readonly productWriter: InMemoryProductRepository;
  readonly sales: InMemorySaleRepository;
  readonly saleWriter: InMemorySaleRepository;
  readonly noSalesWeeks: NoSalesWeekRepository & NoSalesWeekWriter;
  readonly noSalesWeekWriter: NoSalesWeekRepository & NoSalesWeekWriter;
  readonly photos: InMemoryPhotoStorage;
  readonly archiveIo: InMemoryArchiveIo;
  readonly backupFiles: FakeBackupFiles;
  readonly fileSharer: FakeFileSharer;
  readonly documentPicker: FakeDocumentPicker;
  readonly photoPicker: FakePhotoPicker;
  readonly notifications: FakeNotificationScheduler;
  readonly notificationResponses: FakeNotificationResponses;
}

/** Transacciones sin base: ejecuta el bloque tal cual y propaga su error como rechazo. */
const inlineTransactions: TransactionRunner = {
  run: <T>(work: () => T extends PromiseLike<unknown> ? never : T): Promise<T> => {
    try {
      return Promise.resolve(work() as T);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  },
};

/**
 * `AppDependencies` de test: `FakeClock`, `SequentialIdGenerator`, el `deviceLocalCalendar`
 * real (con la zona fija de Jest), `RecordingLogger`, un `DataChanges` en memoria que
 * registra en ese logger, transacciones en línea y un repositorio de productos en memoria
 * (`products` y `productWriter` son el mismo objeto), un programador de avisos falso y su reconciliador real conectado a ese `DataChanges`. Los reemplazos deben ser también dobles de test. Las pruebas con base real usan `createTestDatabase`.
 */
export function createTestDependencies(
  overrides: Partial<TestDependencies> = {},
): TestDependencies {
  const logger = overrides.logger ?? new RecordingLogger();
  const dataChanges = overrides.dataChanges ?? createDataChanges(logger);
  const productStore = createInMemoryProductRepository({ dataChanges });
  const saleStore = createInMemorySaleRepository({ dataChanges });
  const noSalesStore = createInMemoryNoSalesWeekRepository({ dataChanges });
  const tipViewStore = createInMemoryTipViewRepository({ dataChanges, logger });
  const preferencesStore = createInMemoryPreferencesRepository({ dataChanges });
  const clock = overrides.clock ?? new FakeClock(epochMsSchema.parse(DEFAULT_TEST_INSTANT));
  const notifications = overrides.notifications ?? createFakeNotificationScheduler();
  const registeredWeeks = createRegisteredWeekReader({
    sales: overrides.sales ?? saleStore,
    noSalesWeeks: overrides.noSalesWeeks ?? noSalesStore,
  });
  const notificationReconciler = createNotificationReconciler(
    () =>
      reconcileNotifications({
        scheduler: notifications,
        preferences: overrides.preferences ?? preferencesStore,
        weeks: registeredWeeks,
        clock,
        calendar: deviceLocalCalendar,
        logger,
      }),
    logger,
  );
  return {
    clock,
    calendar: deviceLocalCalendar,
    ids: new SequentialIdGenerator(),
    logger,
    dataChanges,
    transactions: inlineTransactions,
    products: productStore,
    productWriter: productStore,
    sales: saleStore,
    saleWriter: saleStore,
    noSalesWeeks: noSalesStore,
    noSalesWeekWriter: noSalesStore,
    photos: new InMemoryPhotoStorage(),
    photoPicker: new FakePhotoPicker(),
    fileLock: createFileLock(),
    tipViews: tipViewStore,
    tipCatalog: createFixtureTipCatalog(),
    preferences: preferencesStore,
    notifications,
    notificationReconciler,
    registeredWeeks,
    notificationResponses: createFakeNotificationResponses(),
    backupStore: {
      readSnapshot: () => Promise.resolve(EMPTY_SNAPSHOT),
      countActive: () => Promise.resolve({ products: 0, saleRecords: 0, activePhotos: 0 }),
      replaceAll: () => Promise.resolve(),
    },
    archiveIo: new InMemoryArchiveIo(),
    backupFiles: new FakeBackupFiles(),
    fileSharer: new FakeFileSharer(),
    documentPicker: new FakeDocumentPicker(),
    appVersion: '1.0.0-test',
    ...overrides,
  };
}

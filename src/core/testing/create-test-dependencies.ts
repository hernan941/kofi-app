import type { AppDependencies } from '@/core/providers/app-dependencies';
import { createDataChanges } from '@/core/db/data-changes';
import { createFileLock } from '@/core/files/file-lock';
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
  readonly photoPicker: FakePhotoPicker;
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
 * (`products` y `productWriter` son el mismo objeto) conectado a ese `DataChanges`. Los reemplazos deben ser también dobles de test. Las pruebas con base real usan `createTestDatabase`.
 */
export function createTestDependencies(
  overrides: Partial<TestDependencies> = {},
): TestDependencies {
  const logger = overrides.logger ?? new RecordingLogger();
  const dataChanges = overrides.dataChanges ?? createDataChanges(logger);
  const productStore = createInMemoryProductRepository({ dataChanges });
  const saleStore = createInMemorySaleRepository({ dataChanges });
  const noSalesStore = createInMemoryNoSalesWeekRepository({ dataChanges });
  return {
    clock: new FakeClock(epochMsSchema.parse(DEFAULT_TEST_INSTANT)),
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
    ...overrides,
  };
}

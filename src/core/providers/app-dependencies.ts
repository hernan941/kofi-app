import type { BootFailure, MigrationResult } from '@/core/db/configure-and-migrate';
import type { DataChanges } from '@/core/db/data-changes';
import type {
  ArchiveIo,
  BackupFiles,
  BackupStore,
  DocumentPicker,
  EmergencyExportError,
  FileSharer,
} from '@/features/backup';
import type {
  PhotoPicker,
  PhotoStorage,
  ProductRepository,
  ProductWriter,
} from '@/features/products';
import type {
  NoSalesWeekRepository,
  NoSalesWeekWriter,
  SaleRecordWriter,
  SaleRepository,
} from '@/features/sales';
import type {
  NotificationReconciler,
  NotificationResponseSource,
  NotificationScheduler,
  PreferencesRepository,
  RegisteredWeekReader,
} from '@/features/notifications';
import type { TipCatalog, TipViewRepository } from '@/features/tips';
import type { Clock } from '@/shared/domain/calendar/clock';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';
import type { FileLock } from '@/shared/domain/file-lock';
import type { IdGenerator } from '@/shared/domain/ids';
import type { Result } from '@/shared/domain/result';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import type { Logger } from '@/shared/lib/logger';

/**
 * Dependencias que la raíz de composición entrega a la UI mediante contexto (ADR-005).
 * Solo referencia tipos: las implementaciones las construye `createAppDependencies()` en
 * `core/dependencies`. Cada feature agrega sus campos cuando existen.
 */
export interface AppDependencies {
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly dataChanges: DataChanges;
  readonly transactions: TransactionRunner;
  readonly products: ProductRepository;
  readonly productWriter: ProductWriter;
  readonly sales: SaleRepository;
  readonly saleWriter: SaleRecordWriter;
  readonly noSalesWeeks: NoSalesWeekRepository;
  readonly noSalesWeekWriter: NoSalesWeekWriter;
  readonly photos: PhotoStorage;
  readonly photoPicker: PhotoPicker;
  readonly fileLock: FileLock;
  readonly tipViews: TipViewRepository;
  readonly tipCatalog: TipCatalog;
  readonly preferences: PreferencesRepository;
  readonly notifications: NotificationScheduler;
  readonly notificationReconciler: NotificationReconciler;
  readonly notificationResponses: NotificationResponseSource;
  /** Si una semana tiene registro; lo comparten la reconciliación y el panel de prueba. */
  readonly registeredWeeks: RegisteredWeekReader;
  readonly backupStore: BackupStore;
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: BackupFiles;
  readonly fileSharer: FileSharer;
  readonly documentPicker: DocumentPicker;
  /** Versión de la app que se anota en los respaldos (`expo-constants`). */
  readonly appVersion: string;
}

/** Lo que la raíz recibe de la composición: dependencias y tareas de arranque. */
export interface AppComposition {
  readonly dependencies: AppDependencies;
  /** Migra la base; lo ejecuta `MigrationGate` una sola vez por proceso. */
  readonly migrateDatabase: () => Promise<MigrationResult>;
  /** Tareas que corren después del primer render (recolección de huérfanos); `MigrationGate` las agenda una sola vez. */
  readonly runAfterFirstRender: () => Promise<void>;
  /**
   * Exportación de emergencia de la pantalla de error de arranque (ADR-006, F8.8): copia cruda
   * de la base y de las fotos, que se comparte; no escribe en la base.
   */
  readonly exportEmergency: (
    reason: BootFailure['kind'],
  ) => Promise<Result<void, EmergencyExportError>>;
}

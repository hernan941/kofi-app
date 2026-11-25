# Diseño técnico — Respaldo y exportación (F8)

- **Tarea**: F8.0 de `docs/plan-v1.md`. Rige F8.1 a F8.11.
- **ADRs**:
  - ADR-012 (formato v1, ZIP restringido, lector y escritor propios, exportación, restauración, CSV);
  - ADR-006 (exportación de emergencia, excepción de borrado físico, `runInTransaction`);
  - ADR-007 (tablas, restricciones, regla 15 de tolerancia);
  - ADR-008 (fotos inmutables, `.part`, lock de archivos, huérfanos);
  - ADR-005 (capas, `FileSharer`, `DocumentPicker`, `backup` depende de `core/db` y `core/files`);
  - ADR-009 (`DataChanges`), ADR-010 (Zod *strict*), ADR-013 y ADR-016 (semilla de E2E), ADR-015 (fecha local del nombre).
- **Decisiones**: D-08, D-09, D-10, D-22, D-23, D-27 y D-28.
- **Versiones verificadas** (2026-11-13):
  - instaladas, revisadas en `node_modules`: `expo-file-system` 58.0.13 (`File.open` → `FileHandle` con `offset`, `size`, `readBytes`, `writeBytes`, `close`; `FileMode`; `File.digest('SHA-256')`; `File.move`/`rename`; `Paths.availableDiskSpace`), `expo-crypto` 58.0.8 (`digest(algorithm, BufferSource)`), `expo-sqlite` 58.0.17 (`backupDatabaseAsync({ sourceDatabase, destDatabase })`, `openDatabaseAsync(name, options, directory)`, `defaultDatabaseDirectory`);
  - tarballs de npm: `expo-sharing` 58.0.23 (`shareAsync(url, { mimeType, UTI, dialogTitle })`, `isAvailableAsync`; su plugin está desactivado por defecto y su `FileProvider` ya cubre `files-path` y `cache-path`) y `expo-document-picker` 58.0.5 (`getDocumentAsync({ type, copyToCacheDirectory, multiple })`; en Android copia a `cacheDir/DocumentPicker/`).
- **Base de código revisada**:
  - `core/db/{transaction,data-changes,table-names,client,open,configure-and-migrate}.ts`, `core/files/file-lock.ts`, `shared/domain/file-lock.ts`;
  - `features/products/{domain/photo-ports.ts,adapters/expo-photo-storage.ts,adapters/cache-files.ts,use-cases/collect-orphan-photos.ts}`;
  - `features/sales/{index.ts,components/channel-labels.ts}`;
  - `core/providers/{migration-gate.tsx,app-dependencies.ts}`, `shared/ui/boot-error-screen.tsx`;
  - `core/e2e/*`, `src/app/{+native-intent,e2e/diagnostics}.tsx`, `e2e/maestro/README.md`.
- Este diseño **aplica** ADR-012 y ADR-006 sin cambiar sus decisiones. La sección 6.1 marca los agregados de firma. **Hay una condición de parada para F8.11** (6.1, punto 1).

---

## 1. Resumen del enfoque

- **Tres capas de datos con contratos distintos**:
  1. `DatabaseSnapshot`: todas las filas de las siete tablas respaldables, con archivadas y borradas lógicamente. Sigue al esquema actual.
  2. `BackupDataV1`: el contrato público y congelado de `data.json`, definido con esquemas Zod *strict*.
  3. Los mapeos puros entre ambos.

  Un test de la capa de datos compara las columnas de cada tabla Drizzle con las del snapshot. Si una migración agrega una columna, el test falla hasta que el respaldo la contemple.
- **ZIP restringido** (`domain/zip/`, puro):
  - solo STORED, sin ZIP64, sin data descriptors, sin comentarios ni campos extra, sin cifrado y con nombres ASCII de la lista blanca;
  - el lector valida EOCD, directorio central y encabezados locales con **acceso aleatorio** y exige que los encabezados y los datos **cubran exactamente** `[0, cdOffset)`, sin huecos ni solapes. Así rechaza bytes escondidos, entradas solapadas y un segundo EOCD;
  - el escritor lee cada entrada completa, calcula el CRC32 en JS y escribe encabezado local, datos, directorio central y EOCD.

  La E/S queda detrás de `ArchiveIo`, `RandomAccessFile` y `SequentialWriter`.
- **Exportación**: lock de archivos → instantánea consistente → `sha256` nativo de cada foto activa desde el disco (corrige filas desfasadas y marca como borradas las que no tienen archivo) → `data.json` y manifiesto en memoria → comprobación de espacio libre → ZIP en `Paths.cache/backups/` → liberar el lock → compartir.
- **Restauración en dos pasos**:
  - `prepareRestore` valida todo **sin tocar nada**: contenido `PK\x03\x04`, estructura, manifiesto, entradas iguales a `manifest.json` más `manifest.files`, `data.json` con CRC32, `sha256` y esquema, e integridad referencial. Devuelve un plan con la vista previa;
  - `confirmRestore`, con el lock tomado: espacio libre → **respaldo de seguridad** completo en `Paths.document/safety/` (se conserva solo el último, D-22) → copia de cada foto a `photos/<id>.jpg.part`, verificación de `sha256` y renombrado **antes** del commit → una sola `runInTransaction` que reemplaza las siete tablas → `DataChanges` con todas, que también dispara la reconciliación de notificaciones.

  No hay *staging* ni intercambio de directorios ni marcador. Las preferencias de notificación no se tocan (D-28).
- **CSV**: dos archivos (`ventas.csv` y `productos.csv`, D-10) generados por funciones puras desde el mismo snapshot. Llevan BOM, `;`, CRLF, comillas RFC 4180 y protección contra inyección de fórmulas.
- **Exportación de emergencia** (ADR-006, F8.8): desde la pantalla de error de arranque, copia cruda de la base con `backupDatabaseAsync` a un `.db` nuevo, más `photos/`, empaquetada con el mismo escritor STORED y compartida. No usa el snapshot ni `BackupDataV1`.
- **Semilla de E2E** (F8.11): `cuantovendi://e2e/seed?fixture=basic|large` restaura un ZIP *fixture* por el camino real de restauración. Los *fixtures* los genera un test de Node con fábricas deterministas y el escritor puro.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/backup/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/snapshot.ts` | `DatabaseSnapshot` y sus filas (`SnapshotProductRow` …), `SNAPSHOT_COLUMNS` (columnas por tabla, para el test de cobertura). | F8.3 |
| `domain/format/backup-data-v1.ts` | Esquemas Zod *strict* de las siete colecciones y `backupDataV1Schema`; los tipos `BackupDataV1` y `Backup*V1` se infieren. | F8.3 |
| `domain/format/manifest.ts` | `backupManifestV1Schema`, `BackupManifestV1`, `manifestEnvelopeSchema` (`format` y `formatVersion` con validación laxa, para decidir `not_a_backup` o `newer_format` antes del esquema *strict*), `SUPPORTED_FORMAT_VERSION = 1`. | F8.3 |
| `domain/format/mapping.ts` | `snapshotToBackupData`, `backupDataToSnapshot`: campo por campo, con filas ordenadas por id para un JSON determinista. | F8.3 |
| `domain/format/read-backup-data.ts` | `readBackupData(formatVersion, json)`: hoy solo v1; es el punto donde se encadenarán las `upgradeVnToVn+1`. | F8.3 |
| `domain/format/integrity.ts` | `checkIntegrity(data)`: ids únicos, referencias, versión del ítem del mismo producto, id de "no vendí" = UUIDv5 de su lunes, conteos; `checkPhotoFiles(data, manifest)`. | F8.3 |
| `domain/format/export-snapshot.ts` | `prepareExportSnapshot(snapshot, diskPhotos, now)`: usa el `sha256` y el tamaño del disco, marca como borradas las fotos sin archivo y devuelve advertencias contables. | F8.5 |
| `domain/format/contents.ts` | `buildManifest(...)`, `encodeJson(value)` (JSON compacto → UTF-8), `photoEntryPath(id)`, `photoIdFromEntryPath(path)`. | F8.3 / F8.5 |
| `domain/zip/crc32.ts` | `crc32(previous, chunk)` con tabla IEEE. | F8.3 |
| `domain/zip/format.ts` | Constantes de firmas y tamaños, lectura y escritura *little-endian* sobre `DataView`, `ZipFormatError`, `ZipEntry`, `ZipLimits`, `BACKUP_ZIP_LIMITS`. | F8.3 |
| `domain/zip/entry-names.ts` | Lista blanca de la restauración (`isBackupEntryName`), `isSafeEntryName` del escritor (ASCII imprimible, sin `\`, sin `/` inicial, sin segmentos `..` ni vacíos, ≤ 255 bytes) y comparación sin mayúsculas para duplicados. | F8.3 |
| `domain/zip/reader.ts` | `parseEndOfCentralDirectory`, `parseCentralDirectory`, `resolveLocalHeader`, `checkLayout` (firmas de ADR-012). | F8.3 |
| `domain/zip/writer.ts` | `encodeLocalHeader`, `encodeCentralDirectory` (directorio central + EOCD). | F8.3 |
| `domain/zip/archive.ts` | Orquestación sobre los puertos: `openStoredArchive(file, limits)`, `readVerifiedEntry(file, entry)` y `writeStoredArchive(writer, entries, onProgress)`. Sin E/S propia. | F8.3 |
| `domain/utf8.ts` | `encodeUtf8` y `decodeUtf8Strict` puros (rechaza secuencias inválidas, *overlong* y sustitutos). Igual en Jest y en Hermes. | F8.3 |
| `domain/csv/csv-writer.ts` | `escapeCsvCell`, `serializeCsv(rows)` (BOM, `;`, CRLF, RFC 4180, prefijo `'`). | F8.2 |
| `domain/csv/sales-csv.ts` | `buildSalesCsv(snapshot, channelLabels)`. | F8.2 |
| `domain/csv/products-csv.ts` | `buildProductsCsv(snapshot)`. | F8.2 |
| `domain/space.ts` | `estimateArchiveBytes(entries)`, `requiredBytesForExport`, `requiredBytesForRestore`, `FREE_SPACE_MARGIN_BYTES`. | F8.5 / F8.6 |
| `domain/file-names.ts` | `backupFileName(date)`, `emergencyFileName(date)`, `safetyFileName(createdAt)`, `parseSafetyFileName(name)`, `SALES_CSV_FILE_NAME`, `PRODUCTS_CSV_FILE_NAME`. | F8.5 |
| `domain/errors.ts` | `RestoreError` (ADR-012), `ExportError`, `EmergencyExportError`. | F8.3 |
| `domain/progress.ts` | `ExportProgress`, `RestoreProgress`. | F8.5 / F8.6 |
| `domain/ports.ts` | `RandomAccessFile`, `SequentialWriter`, `ArchiveIo` (ADR-012), `BackupFiles`, `FileSharer` y `DocumentPicker` (ADR-005), `DatabaseCopier`. | F8.3 / F8.4 |
| `domain/index.ts` | API pública del dominio. | F8.3 |
| `data/backup-store.ts` | Interfaz `BackupStore` (`readSnapshot`, `replaceAll`) y `BackupDatabaseAccess`. | F8.6 |
| `data/drizzle-backup-store.ts` | Lee las siete tablas en una transacción de solo lectura. `replaceAll` borra de hijos a padres e inserta de padres a hijos, en lotes de 200, en una sola `runInTransaction`, tocando las siete tablas. No toca `notification_preferences` ni `__drizzle_migrations`. | F8.6 |
| `adapters/expo-archive-io.ts` | `ArchiveIo` sobre `FileHandle`, `File.digest`, `expo-crypto` y `Paths.availableDiskSpace`. Serializa las operaciones de cada handle. | F8.4 |
| `adapters/expo-backup-files.ts` | `BackupFiles`: carpetas `Paths.cache/backups/`, `Paths.cache/emergency/` y `Paths.document/safety/`; nombres validados por patrón; borrados solo dentro de esas carpetas y de `Paths.cache/DocumentPicker/`. | F8.4 |
| `adapters/expo-file-sharer.ts` | `FileSharer` sobre `expo-sharing`. | F8.4 |
| `adapters/expo-document-picker.ts` | `DocumentPicker` sobre `expo-document-picker` (`type: '*/*'`, `copyToCacheDirectory: true`, `multiple: false`). | F8.4 |
| `use-cases/collect-backup-contents.ts` | Instantánea, hashes de fotos, `data.json`, manifiesto y tamaño estimado (sin escribir). Lo comparten la exportación y el respaldo de seguridad. | F8.5 |
| `use-cases/write-backup-contents.ts` | Escribe el ZIP de un `BackupContents` en una URI (requiere el lock tomado por quien llama). | F8.5 |
| `use-cases/export-backup.ts` | `exportBackup`: lock, contenidos, espacio, ZIP, liberar el lock, compartir. | F8.5 |
| `use-cases/prepare-restore.ts` | `prepareRestore`: pasos 1 a 4 de ADR-012 → `RestorePlan`. | F8.6 |
| `use-cases/confirm-restore.ts` | `confirmRestore`: pasos 6 a 11 de ADR-012. | F8.6 |
| `use-cases/safety-backup.ts` | `writeSafetyBackup`: `.part` → verificación estructural → renombrado → borrado de los anteriores (D-22). | F8.6 |
| `use-cases/export-csv.ts` | `exportSalesCsv`, `exportProductsCsv`. | F8.2 / F8.7 |
| `use-cases/export-emergency.ts` | `exportEmergency` (F8.8). | F8.8 |
| `use-cases/cleanup-backup-temporaries.ts` | Limpieza al arrancar: temporales de más de 15 minutos y respaldos de seguridad sobrantes. | F8.5 |
| `hooks/use-export-backup.ts`, `hooks/use-export-csv.ts`, `hooks/use-restore-backup.ts`, `hooks/restore-flow.ts` | Estado de cada flujo; `restore-flow.ts` es un reducer puro (`idle → picking → inspecting → preview → restoring → done | failed`). | F8.7 |
| `components/restore-preview.tsx`, `components/backup-progress.tsx`, `components/backup-actions.tsx` | Presentación según F8.1. | F8.7 |
| `components/backup-messages.ts` | Mensaje en español, amable y sin tecnicismos, para cada `RestoreError['code']`, cada `ExportError['code']` y el error inesperado. | F8.7 |
| `screens/backup-screen.tsx` | Exportar ventas y productos, crear respaldo, restaurar. | F8.7 |
| `testing/in-memory-archive-io.ts` | `ArchiveIo` sobre un mapa `uri → Uint8Array`, con espacio libre configurable y fallos inyectables. | F8.4 |
| `testing/fake-backup-files.ts`, `testing/fake-file-sharer.ts`, `testing/fake-document-picker.ts` | Dobles para casos de uso y UI. | F8.4 |
| `testing/zip-fixture-builder.ts` | Constructor de ZIP para tests que permite **romper** cualquier campo (método, flags, tamaños, offsets, extras, comentario, EOCD duplicado). | F8.3 |
| `domain/zip/__fixtures__/` | `standard-tool-stored.zip` (generado una vez con `zip -0 -X -D`, sin campos extra ni entradas de directorio) y su receta en un `README.md`. | F8.3 |
| `domain/format/__fixtures__/v1/` | `valid.zip`, `tampered.zip` (un byte de `data.json` cambiado, con el CRC correcto pero el `sha256` del manifiesto distinto) y `future-format.zip` (`formatVersion: 2`). **Congelados**: se generan una vez y nunca se regeneran, porque son el contrato de lectura. | F8.3 |
| `index.ts` | Screens, hooks, use cases que usan `core/dependencies`, `features/e2e` y la composición (`exportEmergency`, `cleanupBackupTemporaries`, `prepareRestore`, `confirmRestore`), adaptadores y tipos de puertos. | F8.2 a F8.8 |

### 2.2 Semilla de E2E (`src/features/e2e/`, F8.11)

| Archivo | Responsabilidad |
|---|---|
| `fixtures.ts` | `E2E_FIXTURES = { basic: require('../../../e2e/fixtures/basic.zip'), large: require('../../../e2e/fixtures/large.zip') }` y `e2eFixtureNameSchema` (`z.enum(['basic', 'large'])`). Solo se carga dentro de la rama del *flag*. |
| `adapters/expo-fixture-assets.ts` | `materializeFixture(module)`: `Asset.fromModule(module).downloadAsync()` → `localUri`. **Requiere `expo-asset`** (6.1, punto 1). |
| `hooks/use-seed-fixture.ts` | Copia el *fixture* a `Paths.cache/backups/` y ejecuta `prepareRestore` + `confirmRestore` del índice de `backup`. Expone el estado. |
| `screens/seed-screen.tsx` | Muestra "Cargando datos de prueba…" y después "Datos de prueba cargados: <nombre>" (texto que espera Maestro), o el error. |
| `testing/fixture-factories.ts` | Fábricas puras y deterministas (`FakeClock`, `SequentialIdGenerator`) de `DatabaseSnapshot` para `basic` y `large`, y `paddedJpeg(base, targetBytes, seed)`, que agrega segmentos `COM` con bytes pseudoaleatorios deterministas (incluidas las firmas `PK\x03\x04`, `PK\x01\x02` y `PK\x07\x08`). |
| `data/e2e-fixtures.test.ts` | Genera los *fixtures*. Con `E2E_FIXTURES_WRITE=1` los escribe en `e2e/fixtures/`; sin la variable, verifica (sección 5.8). Está en `data/` porque usa `createTestDatabase`. |
| `src/app/e2e/seed.tsx` (ruta) | Igual que `e2e/diagnostics.tsx`: `if (process.env.EXPO_PUBLIC_E2E === '1')` en línea con `require('@/features/e2e')` dentro de la rama; si no, `<Redirect href="/" />`. Valida `fixture` con `parseRouteParams`. |
| `e2e/fixtures/basic.zip`, `e2e/fixtures/large.zip` | Salida del generador (sobre el versionado de `large`, ver 6.2, punto 7). |
| `e2e/maestro/_shared/seed.yaml` | `openLink: cuantovendi://e2e/seed?fixture=${FIXTURE}` y espera el texto de carga completa. |

### 2.3 Código existente que se modifica

| Archivo | Cambio | Tarea |
|---|---|---|
| `features/products/domain/photo-ports.ts` | `PhotoStorage` suma `partialUriFor(id): string` y `promotePartial(id): Promise<void>` (renombra `photos/<id>.jpg.part` → `photos/<id>.jpg` y falla si el destino existe). Es la única pieza que conoce la estructura de `photos/`. | F8.4 |
| `features/products/adapters/expo-photo-storage.ts` y `testing/in-memory-photo-storage.ts` | Implementan los dos métodos, con el id validado como hoy. | F8.4 |
| `features/products/adapters/cache-files.ts` | `isCacheUri` pasa a `core/files/cache-uri.ts` para que también lo use `backup/adapters` (un adaptador no importa los de otra feature). `cache-files.ts` lo importa de ahí. | F8.4 |
| `shared/domain/file-lock.ts` | `FileLockOwner` suma `'backup_cleanup'`. | F8.5 |
| `core/db/client.ts` | `AppDatabaseHandle` expone la `SQLiteDatabase` de Expo (`native`) para la copia de emergencia. | F8.8 |
| `core/db/database-copier.ts` (nuevo) | `createDatabaseCopier(getHandle)`: `backupDatabaseAsync` a un `.db` nuevo en el directorio pedido y, si la base no abre, copia cruda de `cuantovendi.db`, `-wal` y `-shm`. Nunca escribe en la base de origen. | F8.8 |
| `core/providers/app-dependencies.ts` | Suma `backupStore`, `archiveIo`, `backupFiles`, `fileSharer`, `documentPicker` y `appVersion: string` a `AppDependencies`, y `exportEmergency(reason)` a `AppComposition`. | F8.4 a F8.8 |
| `core/dependencies/create-app-dependencies.ts` | Construye lo anterior (`appVersion` desde `expo-constants`) y agrega `cleanupBackupTemporaries` a `runAfterFirstRender`. | F8.4 a F8.8 |
| `core/providers/migration-gate.tsx` | En `failed`, pasa a `BootErrorScreen` la acción de emergencia con su estado (`idle`, `working`, `done`, `failed`). | F8.8 |
| `shared/ui/boot-error-screen.tsx` | `onEmergencyExport` pasa a `emergencyExport?: { status; onPress }`, con un texto de progreso accesible. Sigue sin ofrecer acciones que escriban en la base. | F8.8 |
| `core/testing/create-test-dependencies.ts` | Suma los dobles de `backup/testing/`. | F8.4 |
| `src/app/settings/backup.tsx` (nuevo) | Renderiza `BackupScreen`; F9 la integra en Ajustes. Fila provisional en `settings-screen.tsx`. | F8.7 |
| `package.json` | `expo-sharing` ~58.0.23 y `expo-document-picker` ~58.0.5 con `npx expo install`. Script `e2e:fixtures` (`E2E_FIXTURES_WRITE=1 jest --selectProjects node --testPathPatterns e2e-fixtures`) y `e2e:build` lo ejecuta antes de compilar. | F8.4 / F8.11 |
| `e2e/maestro/README.md`, `e2e/maestro/config.yaml` | Carpeta `backup/`, subflujo `seed.yaml` y la verificación de que el bundle `release` no incluye `basic.zip` (búsqueda en `assets/` de `npx expo export`). | F8.10 / F8.11 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Snapshot y formato v1

```ts
/**
 * Todas las filas de las tablas respaldables, incluidas las archivadas y las borradas
 * lógicamente. Sigue al esquema actual; `notification_preferences` no está (D-28).
 */
export interface DatabaseSnapshot {
  readonly products: readonly SnapshotProductRow[];
  readonly productVersions: readonly SnapshotProductVersionRow[];
  readonly productPhotos: readonly SnapshotProductPhotoRow[];
  readonly saleRecords: readonly SnapshotSaleRecordRow[];
  readonly saleItems: readonly SnapshotSaleItemRow[];
  readonly noSalesWeeks: readonly SnapshotNoSalesWeekRow[];
  readonly tipViews: readonly SnapshotTipViewRow[];
}

export interface SnapshotProductRow {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string | null;
  readonly archivedAt: EpochMs | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotProductVersionRow {
  readonly id: ProductVersionId;
  readonly productId: ProductId;
  readonly name: string | null;
  readonly pricingMode: 'fixed' | 'negotiable';
  readonly price: Clp | null;
  readonly cost: Clp | null;
  readonly position: number;
  readonly archivedAt: EpochMs | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotProductPhotoRow {
  readonly id: ProductPhotoId;
  readonly productId: ProductId;
  readonly position: number;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotSaleRecordRow {
  readonly id: SaleRecordId;
  readonly soldOn: LocalDate;
  readonly channel: SaleChannel | null;
  readonly note: string | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotSaleItemRow {
  readonly id: SaleItemId;
  readonly saleRecordId: SaleRecordId;
  readonly productId: ProductId;
  readonly productVersionId: ProductVersionId;
  readonly quantity: number;
  readonly unitPrice: Clp;
  readonly unitCost: Clp | null;
  readonly position: number;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotNoSalesWeekRow {
  readonly id: NoSalesWeekId;
  readonly weekStart: LocalDate;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

export interface SnapshotTipViewRow {
  readonly tipId: TipId;
  readonly firstSeenAt: EpochMs;
  readonly updatedAt: EpochMs;
}

/** Columnas SQL de cada tabla que cubre el snapshot; el test de datos las compara con Drizzle. */
export const SNAPSHOT_COLUMNS: Readonly<Record<SnapshotTable, readonly string[]>>;
```

**`BackupDataV1`** (ADR-012) tiene hoy las mismas siete colecciones, con los mismos campos en camelCase y códigos estables. Los tipos `Backup*V1` se infieren de esquemas `z.strictObject` que reutilizan las primitivas con marca de `shared/domain` (`productIdSchema`, `clpSchema`, `localDateSchema`, `epochMsSchema`…), `tipIdSchema` de `@/features/tips/domain` y `SALE_CHANNELS` de `@/features/sales/domain`. Reglas de los esquemas:
- reflejan **exactamente** los `CHECK` de ADR-007 (montos 0..999.999.999, `quantity` 1..9999, `position >= 0`, `width`, `height` y `byteSize > 0`, `sha256` de 64 hex en minúsculas, `pricingMode` coherente con `price`, `weekStart` lunes, fechas válidas);
- aplican los límites de longitud de D-27 (nombres 1..80, descripción ≤ 1000, nota ≤ 500), sin recortar ni transformar;
- **no** exigen invariantes de negocio (un producto con alguna versión activa, nombres de versión únicos, registros con ítems), por la regla 15 de ADR-007 (tolerancia);
- claves desconocidas → error (*strict*).

```ts
/** Lo que se exporta en `data.json`; contrato público y congelado de la versión 1. */
export type BackupDataV1 = z.infer<typeof backupDataV1Schema>;

/** Mapeos puros; la ida y vuelta no pierde datos. Ordenan cada colección por id (o `tipId`). */
export function snapshotToBackupData(snapshot: DatabaseSnapshot): BackupDataV1;
export function backupDataToSnapshot(data: BackupDataV1): DatabaseSnapshot;

/** Manifiesto (ADR-012). `createdAt` es ISO 8601 UTC (`toISOString`). */
export interface BackupManifestV1 {
  readonly format: 'cuantovendi-backup';
  readonly formatVersion: 1;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly counts: {
    /** Productos con `deletedAt` nulo, archivados incluidos. */
    readonly products: number;
    /** Registros de venta con `deletedAt` nulo. */
    readonly saleRecords: number;
    /** Fotos con `deletedAt` nulo; cada una tiene su archivo. */
    readonly activePhotos: number;
  };
  /** `data.json` y una entrada `photos/<id>.jpg` por foto activa; nunca `manifest.json`. */
  readonly files: readonly {
    readonly path: string;
    readonly byteSize: number;
    readonly sha256: string;
  }[];
}

/**
 * Valida `data.json` ya decodificado según la versión del manifiesto. Hoy solo v1; una versión
 * nueva agrega su esquema y una función `upgradeV1ToV2` pura encadenada aquí.
 */
export function readBackupData(
  formatVersion: number,
  json: unknown,
): Result<BackupDataV1, RestoreError>;

/**
 * Integridad:
 * - ids únicos por tabla;
 * - versiones, fotos e ítems con padres existentes;
 * - versión del ítem del mismo producto que el ítem;
 * - `noSalesWeeks.id` = `noSalesWeekId(weekStart)` y `weekStart` único;
 * - `counts` del manifiesto iguales a los calculados.
 *
 * Las referencias rotas dan `broken_references`; lo demás, `invalid_data`.
 */
export function checkIntegrity(
  data: BackupDataV1,
  manifest: BackupManifestV1,
): Result<void, RestoreError>;

/**
 * Cada foto activa tiene exactamente un archivo `photos/<id>.jpg` en `manifest.files`, con su
 * mismo `byteSize` y `sha256`. Las borradas no tienen archivo. Un archivo sin foto activa es error.
 */
export function checkPhotoFiles(
  data: BackupDataV1,
  manifest: BackupManifestV1,
): Result<void, RestoreError>;
```

### 3.2 Formato ZIP restringido

**Lo que escribe el escritor** (todo *little-endian*; las fechas DOS son fijas para que la salida sea determinista):

| Registro | Campos |
|---|---|
| Encabezado local (`PK\x03\x04`, 30 bytes + nombre) | versión necesaria **20**, flags **`0x0800`** (UTF-8), método **0**, hora **0**, fecha **`0x0021`** (1980-01-01), CRC32, tamaño comprimido = descomprimido, largo del nombre, extra **0**, nombre. |
| Directorio central (`PK\x01\x02`, 46 bytes + nombre) | versión creada por **20**, versión necesaria **20**, flags, método, hora y fecha iguales al local; CRC y tamaños; nombre; extra **0**; comentario **0**; disco **0**; atributos interno y externo **0**; offset del encabezado local. |
| Fin del directorio (`PK\x05\x06`, 22 bytes) | disco **0**, disco del directorio **0**, entradas en el disco = entradas totales, tamaño y offset del directorio, comentario **0**. |

Orden de escritura: `manifest.json`, `data.json` y después las fotos por id ascendente. El escritor rechaza nombres que no cumplan `isSafeEntryName`, más de 65.534 entradas, una entrada o un offset `>= 0xFFFFFFFF` (nunca ZIP64) y un `readRange` que devuelva otra cantidad de bytes que la declarada.

**Lo que acepta el lector** (y el error de cada rechazo; ninguna validación lee datos antes de que la estructura completa sea válida):

| Validación | Error (`ZipFormatError`) |
|---|---|
| Tamaño < 22, sin `PK\x05\x06` en los últimos 22 bytes exactos | `not_a_zip` |
| Tamaño > `maxArchiveBytes`; entradas > `maxEntries`; `cdSize > entryCount × (46 + 255)`; una entrada > `maxEntryBytes` (`data.json` > `maxDataJsonBytes`) | `too_large` |
| Disco ≠ 0, entradas del disco ≠ totales, comentario en el EOCD, cualquier valor centinela `0xFFFF` o `0xFFFFFFFF` (ZIP64), versión necesaria > 20, flag de cifrado (bit 0), de data descriptor (bit 3) o cualquier bit distinto del 11, campo extra o comentario en una entrada | `unsupported_feature` |
| Método ≠ 0, o tamaño comprimido ≠ descomprimido | `compressed_entry` |
| Nombre vacío, > 255 bytes, con bytes fuera de ASCII imprimible o fuera de la lista blanca | `invalid_name` |
| Nombre repetido, comparado sin mayúsculas, en el orden del directorio central | `duplicate_entry` |
| `cdOffset + cdSize ≠ tamaño − 22`; el directorio no ocupa exactamente `cdSize` bytes; una entrada termina después de `cdOffset`; hay **huecos** entre entradas o antes de la primera (bytes escondidos, un segundo EOCD) | `out_of_bounds` |
| Dos rangos de entradas se solapan | `overlapping_entries` |
| El encabezado local no coincide con el central (firma, versión, flags, método, CRC, tamaños, largo o bytes del nombre) | `header_mismatch` |

`checkLayout` ordena por `localHeaderOffset` y exige que la primera entrada empiece en 0 y que cada una empiece donde termina la anterior (`dataOffset + size`), hasta llegar exactamente a `cdOffset`. Acepta lo que escribe una herramienta estándar con `zip -0 -X -D`: versión 10, flags 0 y atributos externos de Unix (que se ignoran).

**Lista blanca de la restauración**: `manifest.json`, `data.json` y `^photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$`.

**`ZipLimits` de v1** (`BACKUP_ZIP_LIMITS`):

| Límite | Valor | Motivo |
|---|---|---|
| `maxArchiveBytes` | 2.147.483.647 (2 GiB − 1) | Queda lejos de los centinelas de 32 bits y alcanza para unas 5.000 fotos de 400 KB. |
| `maxEntries` | 20.002 | `manifest.json`, `data.json` y hasta 20.000 fotos activas (más de 3.000 productos con 6 fotos). El directorio central queda por debajo de 2 MB. |
| `maxEntryBytes` | 16.777.216 (16 MiB) | Una foto de la app pesa entre 150 y 400 KB (ADR-008). El escritor carga la entrada completa en memoria. También es el límite del manifiesto. |
| `maxDataJsonBytes` | 33.554.432 (32 MiB) | Unas diez veces el volumen de un uso intenso de varios años. Acota la memoria de decodificar y parsear en un Android de gama baja. |

La exportación aplica los **mismos** límites antes de escribir y, si los supera, falla con `too_large`. Así la app nunca produce un respaldo que ella misma no pueda restaurar.

```ts
/** Ver la tabla de ADR-012; los valores concretos están en `BACKUP_ZIP_LIMITS`. */
export interface ZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxDataJsonBytes: number;
}

/** Archivo validado: entradas por nombre y offset del directorio central. */
export interface StoredArchive {
  readonly size: number;
  readonly cdOffset: number;
  readonly entries: ReadonlyMap<string, ZipEntry>;
}

/**
 * Lee el EOCD (últimos 22 bytes), el directorio central y cada encabezado local, y aplica
 * `checkLayout`. No lee datos de las entradas.
 */
export function openStoredArchive(
  file: RandomAccessFile,
  limits: ZipLimits,
): Promise<Result<StoredArchive, ZipFormatError>>;

/** Lee una entrada chica completa y compara su CRC32. */
export function readVerifiedEntry(
  file: RandomAccessFile,
  entry: ZipEntry,
): Promise<Result<Uint8Array, { readonly code: 'checksum_mismatch'; readonly path: string }>>;

/** Entrada a escribir; `readRange` lee su contenido (bytes en memoria o un archivo). */
export interface ArchiveEntryInput {
  readonly path: string;
  readonly size: number;
  readRange(offset: number, length: number): Promise<Uint8Array>;
}

/**
 * Escribe el ZIP STORED en orden. Una entrada de hasta 16 MiB se lee completa una vez. Una más
 * grande (solo la base de la exportación de emergencia) se lee dos veces por bloques de 1 MiB:
 * la primera para el CRC32 y la segunda para copiar.
 */
export function writeStoredArchive(
  writer: SequentialWriter,
  entries: readonly ArchiveEntryInput[],
  onEntryWritten?: (done: number, total: number) => void,
): Promise<readonly ZipEntry[]>;
```

Las firmas de bajo nivel (`parseEndOfCentralDirectory`, `parseCentralDirectory`, `resolveLocalHeader`, `checkLayout`, `crc32`, `encodeLocalHeader`, `encodeCentralDirectory`) son las de ADR-012.

### 3.3 Puertos (`domain/ports.ts`)

```ts
/** Lectura con acceso aleatorio (ADR-012). `read` devuelve exactamente `length` bytes o falla. */
export interface RandomAccessFile {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  close(): void;
}

/** Escritura secuencial. */
export interface SequentialWriter {
  readonly position: number;
  write(bytes: Uint8Array): Promise<void>;
  close(): void;
}

/** E/S de archivos para respaldos (ADR-012); adaptador delgado sobre `FileHandle`. */
export interface ArchiveIo {
  openForRead(uri: string): Promise<RandomAccessFile>;
  /** Crea o trunca el archivo (con carpetas intermedias). */
  createForWrite(uri: string): Promise<SequentialWriter>;
  /** Copia exactamente `[offset, offset + length)` de `source` a `targetUri`, por bloques de 1 MiB. */
  copyRange(source: RandomAccessFile, offset: number, length: number, targetUri: string): Promise<void>;
  /** Hex en minúsculas. */
  sha256OfFile(uri: string): Promise<string>;
  sha256OfBytes(bytes: Uint8Array): Promise<string>;
  availableDiskSpace(): number;
}

/** Respaldo de seguridad existente. */
export interface SafetyBackupInfo {
  readonly uri: string;
  readonly createdAt: EpochMs;
}

/**
 * Carpetas propias de los respaldos. Solo arma rutas desde nombres generados por
 * `domain/file-names.ts` y validados por patrón, y solo borra dentro de sus carpetas.
 */
export interface BackupFiles {
  /** `Paths.cache/backups/<fileName>`; crea la carpeta y borra un archivo previo con ese nombre. */
  exportTarget(fileName: string): string;
  /** `Paths.document/safety/cuantovendi-seguridad-<createdAt>.zip(.part)`. */
  safetyTarget(createdAt: EpochMs): { readonly partUri: string; readonly finalUri: string };
  /** Renombra el `.part` al nombre final. */
  promoteSafety(target: { readonly partUri: string; readonly finalUri: string }): Promise<void>;
  /** Borra todo lo de `safety/` salvo `keepUri` (D-22). */
  pruneSafety(keepUri: string): Promise<void>;
  latestSafety(): SafetyBackupInfo | null;
  /** `Paths.cache/emergency/`; crea la carpeta. */
  emergencyDirectory(): string;
  /** Borra la copia del selector si está bajo `Paths.cache`; si no, la registra y no la toca. */
  discardPicked(uri: string): void;
  /**
   * Borra los archivos de `backups/`, `emergency/` y `DocumentPicker/`, y los `.part` de
   * `safety/`, con más de `minAgeMs` de antigüedad. Conserva solo el `.zip` más nuevo de `safety/`.
   */
  sweep(now: EpochMs, minAgeMs: number): Promise<{ readonly removed: number }>;
}

/** Menú de compartir del sistema (ADR-005), con `isAvailable` agregado. */
export interface FileSharer {
  isAvailable(): Promise<boolean>;
  share(fileUri: string, options: { readonly mimeType: string; readonly uti?: string }): Promise<void>;
}

/** Documento elegido, ya copiado a la caché por el selector. */
export interface PickedDocument {
  readonly uri: string;
  readonly name: string;
  readonly size: number | null;
}

/** Selector de archivos (ADR-005); `null` si la persona cancela. */
export interface DocumentPicker {
  pickSingle(options: { readonly mimeTypes: readonly string[] }): Promise<PickedDocument | null>;
}

/** Archivo de la base copiado para la exportación de emergencia. */
export interface CopiedDatabaseFile {
  readonly uri: string;
  /** `cuantovendi.db` y, en modo crudo, `cuantovendi.db-wal` y `cuantovendi.db-shm`. */
  readonly entryName: string;
}

/** Copia la base sin escribir en ella (ADR-006). Vive en `core/db`. */
export interface DatabaseCopier {
  copyTo(directoryUri: string): Promise<{
    readonly mode: 'backup_api' | 'raw_files';
    readonly files: readonly CopiedDatabaseFile[];
  }>;
}
```

**Agregado a `PhotoStorage`** (`products`, ver 2.3):

```ts
/** URI de `photos/<id>.jpg.part`; lanza si el id no es UUID. */
partialUriFor(id: ProductPhotoId): string;
/** Renombra `photos/<id>.jpg.part` a `photos/<id>.jpg`; falla si el destino ya existe. */
promotePartial(id: ProductPhotoId): Promise<void>;
```

### 3.4 Datos (`data/backup-store.ts`)

```ts
/** Acceso a todas las tablas respaldables (ADR-006, excepción de la restauración). */
export interface BackupStore {
  /** Lee las siete tablas completas en una sola transacción de solo lectura (sin `DataChanges`). */
  readSnapshot(): Promise<DatabaseSnapshot>;
  /**
   * En una sola `runInTransaction`:
   * 1. `DELETE` de `sale_items`, `sale_records`, `no_sales_weeks`, `product_photos`,
   *    `product_versions`, `products` y `tip_views`, en ese orden;
   * 2. inserción de padres a hijos.
   *
   * Toca las siete tablas, así que `DataChanges` las emite después del commit. No toca
   * `notification_preferences` ni `__drizzle_migrations`. Si algo falla, rollback completo.
   */
  replaceAll(snapshot: DatabaseSnapshot): Promise<void>;
}
```

### 3.5 Errores y progreso

```ts
/** ADR-012, sin cambios. `invalid_data.issues` lleva rutas como `saleItems.12.quantity` (máx. 20). */
export type RestoreError =
  | { readonly code: 'not_a_backup' }
  | { readonly code: 'invalid_archive'; readonly reason: ZipFormatError }
  | { readonly code: 'newer_format'; readonly formatVersion: number }
  | { readonly code: 'entries_mismatch' }
  | { readonly code: 'checksum_mismatch'; readonly path: string }
  | { readonly code: 'invalid_data'; readonly issues: readonly string[] }
  | { readonly code: 'broken_references' }
  | { readonly code: 'photo_conflict'; readonly photoId: string }
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number };

/** Errores esperables al exportar un respaldo o un CSV. */
export type ExportError =
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number }
  /** Supera `BACKUP_ZIP_LIMITS`: el respaldo no se podría restaurar. */
  | { readonly code: 'too_large' }
  | { readonly code: 'sharing_unavailable' };

/** Errores esperables de la exportación de emergencia. */
export type EmergencyExportError =
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number }
  | { readonly code: 'sharing_unavailable' }
  | { readonly code: 'database_unavailable' };

export type ExportProgress =
  | { readonly phase: 'reading' }
  | { readonly phase: 'hashing_photos'; readonly done: number; readonly total: number }
  | { readonly phase: 'writing'; readonly done: number; readonly total: number }
  | { readonly phase: 'sharing' };

export type RestoreProgress =
  | { readonly phase: 'validating' }
  | { readonly phase: 'checking_space' }
  | { readonly phase: 'safety_backup'; readonly done: number; readonly total: number }
  | { readonly phase: 'copying_photos'; readonly done: number; readonly total: number }
  | { readonly phase: 'applying' }
  | { readonly phase: 'finishing' };
```

Una excepción inesperada (E/S, `SQLITE_FULL`, un `CHECK` que falla) rechaza la promesa del caso de uso. El hook la muestra con un mensaje genérico y amable ("No pudimos terminar. Tus datos siguen como estaban."), que es verdad mientras el fallo ocurra antes del commit. El commit es atómico.

### 3.6 Casos de uso

```ts
export interface BackupContentsDeps {
  readonly store: Pick<BackupStore, 'readSnapshot'>;
  readonly photos: Pick<PhotoStorage, 'listFiles' | 'uriFor'>;
  readonly archiveIo: ArchiveIo;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly appVersion: string;
}

/** Todo lo necesario para escribir un respaldo, sin escribir nada. */
export interface BackupContents {
  readonly manifest: BackupManifestV1;
  readonly manifestBytes: Uint8Array;
  readonly dataBytes: Uint8Array;
  readonly photoFiles: readonly {
    readonly id: ProductPhotoId;
    readonly uri: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly estimatedBytes: number;
}

/** Requiere el lock tomado por quien llama. `too_large` si supera `BACKUP_ZIP_LIMITS`. */
export function collectBackupContents(
  deps: BackupContentsDeps,
  onProgress: (progress: ExportProgress) => void,
): Promise<Result<BackupContents, ExportError>>;

export function writeBackupContents(
  contents: BackupContents,
  targetUri: string,
  io: ArchiveIo,
  onProgress: (progress: ExportProgress) => void,
): Promise<void>;

export interface ExportBackupDeps extends BackupContentsDeps {
  readonly calendar: LocalCalendar;
  readonly fileLock: FileLock;
  readonly backupFiles: BackupFiles;
  readonly fileSharer: FileSharer;
}

/**
 * `acquire('backup_export')` → contenidos → espacio → ZIP en
 * `backups/kofi-respaldo-AAAA-MM-DD.zip` → liberar el lock (`finally`) → compartir
 * (`application/zip`, UTI `public.zip-archive`).
 */
export function exportBackup(
  deps: ExportBackupDeps,
  onProgress: (progress: ExportProgress) => void,
): Promise<Result<{ readonly fileName: string }, ExportError>>;

/** Lo validado por `prepareRestore`, listo para confirmar. No mantiene archivos abiertos. */
export interface RestorePlan {
  readonly sourceUri: string;
  readonly archiveSize: number;
  readonly preview: RestorePreview;
  readonly snapshot: DatabaseSnapshot;
  readonly photos: readonly {
    readonly id: ProductPhotoId;
    readonly dataOffset: number;
    readonly size: number;
    readonly sha256: string;
  }[];
}

/** Vista previa (F8.1): conteos del manifiesto ya verificados contra los datos. */
export interface RestorePreview {
  readonly createdAt: EpochMs;
  readonly products: number;
  readonly saleRecords: number;
  readonly activePhotos: number;
}

export interface RestoreDeps {
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: BackupFiles;
  readonly store: BackupStore;
  readonly photos: Pick<
    PhotoStorage,
    'listFiles' | 'uriFor' | 'partialUriFor' | 'promotePartial' | 'removePartial'
  >;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly appVersion: string;
  readonly limits: ZipLimits;
  /** Deja que la UI pinte la fase `applying` antes del bloque síncrono del commit. */
  readonly yieldToUi: () => Promise<void>;
}

/** Pasos 1 a 4 de ADR-012. No escribe nada; cierra el archivo al terminar, también si falla. */
export function prepareRestore(
  deps: RestoreDeps,
  sourceUri: string,
): Promise<Result<RestorePlan, RestoreError>>;

/** Pasos 6 a 11 de ADR-012. Cualquier error antes del commit deja intactos los datos actuales. */
export function confirmRestore(
  deps: RestoreDeps,
  plan: RestorePlan,
  onProgress: (progress: RestoreProgress) => void,
): Promise<
  Result<
    {
      readonly safetyBackup: SafetyBackupInfo;
      readonly copiedPhotos: number;
      readonly skippedPhotos: number;
    },
    RestoreError
  >
>;

export interface CsvExportDeps {
  readonly store: Pick<BackupStore, 'readSnapshot'>;
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: Pick<BackupFiles, 'exportTarget'>;
  readonly fileSharer: FileSharer;
}

export interface EmergencyExportDeps {
  readonly copier: DatabaseCopier;
  readonly photos: Pick<PhotoStorage, 'listFiles' | 'uriFor'>;
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: Pick<BackupFiles, 'emergencyDirectory'>;
  readonly fileSharer: FileSharer;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly logger: Logger;
  readonly appVersion: string;
}

export interface CleanupDeps {
  readonly backupFiles: Pick<BackupFiles, 'sweep'>;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
}

/** Los CSV no toman el lock (no leen fotos). Comparten con `text/csv`. */
export function exportSalesCsv(
  deps: CsvExportDeps,
  channelLabels: Readonly<Record<SaleChannel, string>>,
): Promise<Result<void, ExportError>>;
export function exportProductsCsv(deps: CsvExportDeps): Promise<Result<void, ExportError>>;

/** F8.8. No lee ni escribe la base de origen salvo con la API de copia de SQLite. */
export function exportEmergency(
  deps: EmergencyExportDeps,
  reason: BootFailure['kind'],
): Promise<Result<void, EmergencyExportError>>;

/** Al arrancar: `tryAcquire('backup_cleanup')`; si está ocupado, no hace nada. */
export function cleanupBackupTemporaries(deps: CleanupDeps): Promise<{ readonly removed: number }>;
```

### 3.7 CSV (`domain/csv/`)

- **Formato**:
  - UTF-8 con BOM (`﻿`), separador `;`, fin de línea CRLF, también después de la última fila;
  - una celda va entre comillas si contiene `;`, `"`, CR o LF, y las comillas internas se duplican (RFC 4180);
  - **inyección de fórmulas**: si la celda empieza con `=`, `+`, `-`, `@`, tabulación o CR, se antepone `'` antes de aplicar las comillas;
  - montos y cantidades como enteros sin símbolo ni separadores; fechas `AAAA-MM-DD`.
- **`ventas.csv`**: una fila por ítem activo de un registro activo, ordenada por `(soldOn, createdAt, id)` del registro y después `(position, id)` del ítem.

  | Columna | Valor |
  |---|---|
  | `Fecha` | `soldOn` |
  | `Registro` | id del registro |
  | `Producto` | nombre actual del producto (aunque esté archivado o borrado) |
  | `Versión` | nombre de la versión o vacío si es `null` |
  | `Cantidad` | `quantity` |
  | `Precio unitario` | `unitPrice` |
  | `Subtotal` | `quantity × unitPrice` |
  | `Dónde vendiste` | etiqueta de `SALE_CHANNEL_LABELS` o vacío |
  | `Nota` | nota o vacío |
- **`productos.csv`**: una fila por versión no borrada de un producto no borrado, con los productos en el orden de D-31 y las versiones por `(position, id)`.

  | Columna | Valor |
  |---|---|
  | `Producto` | nombre |
  | `Versión` | nombre o vacío |
  | `Precio` | `price` o `a convenir` |
  | `Costo` | `cost` o vacío |
  | `Archivado` | `Sí` si el producto o la versión están archivados; si no, `No` |
- Las etiquetas de canal llegan como parámetro: el hook `useExportCsv` pasa `SALE_CHANNEL_LABELS` del índice de `sales`, así hay una sola fuente de esos textos y el dominio de `backup` no importa UI. El orden D-31 usa una función de clave que `products/domain` exporta (agregado chico: `productListSortKey(name)`, extraída de `compareProductsForList`).

### 3.8 Espacio libre (`domain/space.ts`)

```ts
/** Margen fijo para no dejar el teléfono sin espacio: 64 MiB. */
export const FREE_SPACE_MARGIN_BYTES = 67_108_864;

/** Σ(30 + nombre + tamaño) + Σ(46 + nombre) + 22. */
export function estimateArchiveBytes(
  entries: readonly { readonly path: string; readonly size: number }[],
): number;

/** Exportación: el ZIP completo más el margen. */
export function requiredBytesForExport(archiveBytes: number): number;

/** Restauración: respaldo de seguridad + fotos que hay que copiar (las que no existen ya) + margen. */
export function requiredBytesForRestore(input: {
  readonly safetyArchiveBytes: number;
  readonly photosToCopyBytes: number;
}): number;
```

Se compara con `archiveIo.availableDiskSpace()` **una vez**, antes del respaldo de seguridad. Esa cuenta incluye el respaldo de seguridad y la copia de fotos, así que cubre ambos momentos que pide el plan. El archivo elegido ya ocupa la caché, porque el selector lo copió antes.

### 3.9 Ubicaciones y nombres

| Qué | Dónde | Nombre |
|---|---|---|
| Respaldo para compartir | `Paths.cache/backups/` | `kofi-respaldo-AAAA-MM-DD.zip` (fecha local de `Clock` + `LocalCalendar`) |
| CSV | `Paths.cache/backups/` | `ventas.csv`, `productos.csv` (6.2, punto 2) |
| Respaldo de seguridad | `Paths.document/safety/` | `cuantovendi-seguridad-<epochMs de 13 dígitos>.zip` (`.part` mientras se escribe) |
| Emergencia | `Paths.cache/emergency/` | `cuantovendi-<epochMs>.db`, `kofi-emergencia-AAAA-MM-DD.zip` |
| Fotos restauradas | `Paths.document/photos/` | `<id>.jpg.part` → `<id>.jpg`, con el id validado de la fila (nunca el nombre de la entrada del ZIP) |
| Copia del selector | `Paths.cache/DocumentPicker/` (verificado en Android; F8.4 confirma iOS) | La que pone el selector |

Nada escribe fuera de `photos/`, `safety/` y esas carpetas de la caché, siempre con nombres generados por la app o derivados de ids validados.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Exportar un respaldo (F8.5)

```
useExportBackup.run()
  exportBackup
    lease = fileLock.acquire('backup_export')          (huérfanos y borrados de fotos esperan)
    try
      snapshot = store.readSnapshot()                                 [reading]
      disk = photos.listFiles() → sha256OfFile(uriFor(id)), tamaño    [hashing_photos]
      prepareExportSnapshot(snapshot, disk, now)
        sha distinto → usa el del disco + logger.warn('backup_photo_hash_mismatch', { count })
        sin archivo  → fila con deletedAt = now (solo en el respaldo) + logger.warn
      data = snapshotToBackupData(...) → dataBytes = encodeUtf8(JSON.stringify(data))
      manifest = buildManifest(...) → manifestBytes
      límites → too_large · espacio → not_enough_space
      writeStoredArchive(createForWrite(exportTarget(nombre)), [manifest, data, fotos…])  [writing]
    finally lease.release()
    fileSharer.isAvailable() ? share(uri, application/zip, public.zip-archive) : sharing_unavailable  [sharing]
```

- `data.json` se arma en memoria en lugar de pasar por un archivo de caché, como sugiere el paso 4 de ADR-012: sus bytes hacen falta igual para el CRC32 y la escritura, y así se evita un temporal. El hash se calcula con `sha256OfBytes`.
- El ZIP compartido **no se borra al volver de `shareAsync`**: en Android la app de destino puede seguir leyéndolo. Se borra cuando la próxima exportación usa el mismo nombre y, al arrancar, si tiene más de 15 minutos. El plan lo admite ("al terminar o al próximo arranque").

### 4.2 Restaurar (F8.6)

**Preparar** (`prepareRestore`, fase `validating`):
1. `openForRead(sourceUri)`. Si el tamaño supera `maxArchiveBytes` → `invalid_archive / too_large`. Si los primeros 4 bytes no son `PK\x03\x04` → `not_a_backup`.
2. `openStoredArchive`. `not_a_zip` → `not_a_backup`; cualquier otro error → `invalid_archive { reason }`.
3. Sin entrada `manifest.json` → `not_a_backup`. `readVerifiedEntry` (CRC) → `decodeUtf8Strict` → `JSON.parse`:
   - si falla → `not_a_backup`;
   - `format` distinto → `not_a_backup`;
   - `formatVersion > 1` → `newer_format`;
   - esquema *strict* → `invalid_data`.
4. Entradas del ZIP = `{manifest.json} ∪ manifest.files`, con los mismos tamaños → si no, `entries_mismatch`.
5. `data.json`: CRC → `sha256OfBytes` contra el manifiesto → `checksum_mismatch`. Después `decodeUtf8Strict` + `JSON.parse` + `readBackupData` → `invalid_data`, y `checkIntegrity` + `checkPhotoFiles` → `broken_references` o `invalid_data`.
6. Plan con la vista previa. Cierra el archivo (`finally`).

**Confirmar** (`confirmRestore`):
1. `lease = fileLock.acquire('backup_restore')`.
2. Vuelve a abrir el archivo y repite `openStoredArchive`. Si las entradas de fotos no coinciden con el plan → `entries_mismatch`.
3. `[checking_space]`:
   - `current = collectBackupContents(...)` sobre los datos actuales;
   - `existing = photos.listFiles()`;
   - `toCopy` = fotos del plan que no existen;
   - si `availableDiskSpace() < requiredBytesForRestore(...)` → `not_enough_space`.
4. `[safety_backup]` `writeSafetyBackup(current)`:
   - escribe en `.part`;
   - lo reabre con `openStoredArchive` (validación estructural);
   - renombra al nombre final;
   - `pruneSafety(final)` borra el anterior **solo ahora** (D-22).
5. `[copying_photos]` para cada foto del plan:
   - si existe: `sha256OfFile(uriFor(id))` igual → se salta; distinto → `photo_conflict`;
   - si no existe: `copyRange(source, dataOffset, size, partialUriFor(id))` → `sha256OfFile(part)` distinto → `removePartial(id)` + `checksum_mismatch { path }`; igual → `promotePartial(id)`.
6. `[applying]` `await yieldToUi()` → `store.replaceAll(plan.snapshot)`: una `runInTransaction` síncrona que, después del commit, emite `DataChanges` con las siete tablas.
7. `[finishing]` `finally`: `lease.release()`, cerrar el archivo, `backupFiles.discardPicked(sourceUri)`.

**Fallos**:
- Antes del paso 6, los datos actuales quedan intactos.
- Las fotos ya promovidas quedan sin fila (huérfanas) y los `.part` quedan sueltos. La recolección de ADR-008 los borra con la regla de 15 minutos en el próximo arranque.
- El paso 6 es atómico.
- No hay marcador ni intercambio de directorios.

### 4.3 Después de restaurar

- **TanStack Query**: el puente invalida todas las raíces (ADR-009), y Inicio, Calendario, Productos y Consejos se actualizan.
- **Notificaciones**: `DataChanges` incluye `sale_records`, `sale_items` y `no_sales_weeks`, así que `useNotificationTriggers` pide una reconciliación serializada (`docs/architecture/notifications.md`, 4.2). `backup` no importa `notifications`. Un test de integración en `core/dependencies` lo comprueba.
- **Preferencias**: `notification_preferences` no se toca (D-28).
- **Primera venta** (D-36): pasa a contar los registros restaurados, incluidos los borrados.
- **Fotos anteriores**: las que ya no se usan quedan huérfanas hasta el próximo arranque (6.1, punto 9).

### 4.4 CSV (F8.2, F8.7)

`useExportCsv(kind)`:
1. `store.readSnapshot()`;
2. `buildSalesCsv(snapshot, SALE_CHANNEL_LABELS)` o `buildProductsCsv(snapshot)`;
3. `encodeUtf8`, que incluye el BOM;
4. `createForWrite(exportTarget('ventas.csv'))`;
5. `share(uri, { mimeType: 'text/csv', uti: 'public.comma-separated-values-text' })`.

Sin lock y sin espacio especial: se usa un margen igual al tamaño del texto más `FREE_SPACE_MARGIN_BYTES`.

### 4.5 Exportación de emergencia (F8.8)

```
MigrationGate (failed: migration_failed | foreign_key_violation | newer_database)
  BootErrorScreen emergencyExport={ status, onPress }
    composition.exportEmergency(reason)
      dir = backupFiles.emergencyDirectory()
      copier.copyTo(dir)
        handle disponible → openDatabaseAsync('cuantovendi-<epoch>.db', {}, dir) + backupDatabaseAsync({ sourceDatabase, destDatabase }) + close
        si no abre         → copia cruda de cuantovendi.db, -wal y -shm desde defaultDatabaseDirectory
      fotos = photos.listFiles()                       (sin leer la base: su esquema puede ser desconocido)
      espacio → writeStoredArchive([info.json, cuantovendi.db…, photos/<id>.jpg…])
      fileSharer.share(zip, application/zip)
```

- `info.json`: `{ "kind": "cuantovendi-emergency", "createdAt", "appVersion", "reason", "mode" }`.
- Las entradas usan `isSafeEntryName` del escritor y **no** la lista blanca de la restauración. Por eso el lector rechaza ese ZIP con `invalid_name`: restaurar un archivo de emergencia no se soporta en la v1 (ADR-006), y así el rechazo es explícito.
- La base de más de 16 MiB se escribe en dos pasadas por bloques (3.2).
- No hace falta el lock: en el estado `failed` la recolección de huérfanos no corre (`runAfterFirstRender` solo se agenda en `ready`).

### 4.6 Arranque

`runAfterFirstRender` suma `cleanupBackupTemporaries` con `tryAcquire('backup_cleanup')`, después de la recolección de huérfanos. Borra lo de más de 15 minutos de `backups/`, `emergency/` y `DocumentPicker/`, los `.part` de `safety/` y los respaldos de seguridad sobrantes (si un corte dejó dos, queda el más nuevo).

### 4.7 Semilla de E2E (F8.11)

```
maestro: clearState → openLink cuantovendi://e2e/seed?fixture=large
  +native-intent (con el flag) deja pasar → src/app/e2e/seed.tsx (rama del flag) → SeedScreen
    materializeFixture(E2E_FIXTURES.large) → localUri → copia a backups/seed.zip
    prepareRestore → confirmRestore            (el camino real: seguridad, fotos, commit)
    "Datos de prueba cargados: large"
```

- **Generación** (`npm run e2e:fixtures`):
  - fábricas con `FakeClock` en `2026-11-01T12:00:00Z` y `SequentialIdGenerator`;
  - `basic`: 5 productos (uno archivado, uno con tres versiones, "a convenir" y costo), 2 fotos, unas 20 ventas en las 8 semanas anteriores, una semana de "no vendí" y 3 consejos vistos;
  - `large`: 200 productos, unas 200 fotos de unos 250 KB (unos 50 MB), ventas en 3 años y "no vendí" disperso;
  - escritor puro, `JSON.stringify` determinista y fechas DOS fijas.

  Dos generaciones dan los mismos bytes.
- **Fotos de los *fixtures***: `gallery-1..3.jpg` de `e2e/maestro/assets/` con segmentos `COM` agregados por `paddedJpeg`. Son JPEG válidos del tamaño buscado, y meten a propósito las firmas `PK` en los datos.
- **Fechas fijas**: los datos no se mueven con el día en que corre el E2E. Los flujos que usan la semilla verifican meses pasados o conteos, no "esta semana" (6.1, punto 8).

### 4.8 Estado en la UI

`useRestoreBackup` usa el reducer puro `restoreFlow`:

```
idle ─pick─► picking ─null─► idle                         (cancelar el selector no es un error)
                    └uri─► inspecting ─err─► failed(error)
                                      └plan─► preview ─cancel─► idle (discardPicked)
                                                     └confirm─► restoring(progress) ─► done | failed
```

Mientras dura `restoring`, la pantalla impide salir (F8.1 define cómo). `useExportBackup` y `useExportCsv` tienen `idle | working(progress) | done | failed`. No hay store global. Al terminar, la caché se actualiza por `DataChanges`.

---

## 5. Tests que el code-writer escribe primero

### 5.1 CSV (`node`, F8.2)

- `escapeCsvCell`: `;`, `"`, CR, LF, comillas dobles internas.
- Prefijo `'` para `=`, `+`, `-`, `@`, `\t` y `\r` iniciales, combinado con comillas (`"'=1;2"`).
- `serializeCsv`: BOM al principio, CRLF entre filas y al final.
- `ventas.csv`:
  - encabezados exactos;
  - una fila por ítem;
  - subtotal correcto;
  - etiqueta del canal o vacío;
  - nombre actual de un producto archivado;
  - registros o ítems borrados excluidos;
  - orden estable.
- `productos.csv`:
  - una fila por versión;
  - "a convenir";
  - costo vacío;
  - `Sí` por producto archivado y por versión archivada;
  - versiones y productos borrados excluidos;
  - orden D-31 (`ñ` después de `n`).
- Montos como enteros sin separadores; fechas `AAAA-MM-DD`.

### 5.2 ZIP y formato (`node`, F8.3)

- **CRC32**: vectores conocidos (`''` → `0x00000000`, `'123456789'` → `0xCBF43926`, `'The quick brown fox jumps over the lazy dog'` → `0x414FA339`) e incremental por bloques igual a uno solo.
- **UTF-8**: ida y vuelta con tildes, `ñ`, emoji y sustitutos válidos; `decodeUtf8Strict` rechaza bytes de continuación sueltos, *overlong*, sustitutos codificados y secuencias truncadas.
- **Ida y vuelta**: escribir con `writeStoredArchive` sobre un `SequentialWriter` en memoria → `openStoredArchive` → `readVerifiedEntry` devuelve los mismos bytes. La salida es idéntica en dos corridas.
- **Herramienta estándar**: `__fixtures__/standard-tool-stored.zip` se abre y se lee bien.
- ***Fixtures* adversariales** (con `zip-fixture-builder`; cada uno da su código y no llama a ninguna escritura):

  | Caso | Resultado esperado |
  |---|---|
  | `../x`, `..\x`, `/abs`, `C:x`, `photos\<id>.jpg`, NUL en el nombre, `photos/` (directorio), un id en mayúsculas | `invalid_name` |
  | Método 8 o tamaño comprimido ≠ descomprimido | `compressed_entry` |
  | Nombre duplicado; `manifest.json` y `MANIFEST.JSON` | `duplicate_entry` |
  | Encabezado local con otro CRC, tamaño, método o nombre | `header_mismatch` |
  | Entradas que se solapan | `overlapping_entries` |
  | Bytes escondidos entre entradas o antes de la primera | `out_of_bounds` |
  | Archivo truncado (sin EOCD al final) | `not_a_zip` |
  | `cdSize` declarado mayor que los bytes del directorio, o `cdOffset` que no termina en el EOCD | `out_of_bounds` |
  | CRC incorrecto en `data.json` o en `manifest.json` | `checksum_mismatch` de `readVerifiedEntry` |
  | *Zip bomb*: tamaños declarados mayores que los límites | `too_large` |
  | Más de `maxEntries` entradas | `too_large` |
  | Comentario en el EOCD o en una entrada; campo extra | `unsupported_feature` |
  | Dos EOCD (uno agregado al final de un ZIP válido) | `out_of_bounds` |
  | Flag de cifrado o de data descriptor; versión necesaria 45 | `unsupported_feature` |
  | ZIP64 (`0xFFFFFFFF` o `0xFFFF`) | `unsupported_feature` |
  | Foto cuyos datos contienen `PK\x03\x04`, `PK\x07\x08` y `PK\x01\x02` | **se lee bien** |
- **Formato**:
  - ida y vuelta snapshot → `BackupDataV1` → snapshot sin pérdida, con archivados, borrados lógicos, `null` en todos los campos que los admiten y textos con tildes;
  - el esquema rechaza una clave desconocida, un monto `-1` y `1000000000`, `quantity` 0, `sha256` en mayúsculas, un `pricingMode` incoherente y un `weekStart` que no es lunes;
  - `formatVersion: 2` → `newer_format`; `format` distinto → `not_a_backup`;
  - un ítem con una versión de otro producto, una foto de un producto inexistente o un id duplicado → `broken_references` / `invalid_data`;
  - lista blanca;
  - `sha256` de `data.json` distinto del manifiesto → `checksum_mismatch`;
  - foto activa sin archivo, archivo sin foto activa o `byteSize` distinto → `broken_references`;
  - conteos distintos → `invalid_data`.
- ***Fixtures* congelados v1**: `valid.zip` se prepara bien con la vista previa esperada; `tampered.zip` → `checksum_mismatch`; `future-format.zip` → `newer_format`.

### 5.3 Datos (`node`, `createTestDatabase`, F8.6)

- **Cobertura del esquema**: para cada tabla, `Object.keys(getTableColumns(tabla))` en snake_case es igual a `SNAPSHOT_COLUMNS[tabla]`.
- `readSnapshot` trae archivados y borrados lógicos, y no emite `DataChanges`.
- `replaceAll`:
  - sobre una base con datos deja exactamente el snapshot;
  - emite **una vez** las siete tablas;
  - deja `notification_preferences` y `__drizzle_migrations` intactos;
  - `foreign_key_check` limpio;
  - si una inserción falla a la mitad (fila que viola un `CHECK`), rollback completo con los datos previos intactos y sin emitir.
- Ida y vuelta con la base real: snapshot → `BackupDataV1` → JSON → parse → snapshot → `replaceAll` → `readSnapshot` igual al original.

### 5.4 Adaptadores (`ui`, `jest.mock('expo-file-system')`, `jest.mock('expo-crypto')`, `jest.mock('expo-sharing')`, `jest.mock('expo-document-picker')`, F8.4)

- `openForRead` posiciona `offset` y lee el rango; una lectura corta lanza; dos lecturas concurrentes no se mezclan (operaciones serializadas por handle).
- `createForWrite` escribe en orden.
- Escribir con el escritor puro y volver a leer da bytes idénticos.
- `copyRange` copia exactamente el rango pedido por bloques al destino indicado, que en el caso de uso siempre es `partialUriFor(id)`.
- `close` se llama también si una lectura o una escritura falla.
- `sha256OfFile` → `File.digest('SHA-256')` en minúsculas; `sha256OfBytes` → `expo-crypto`; `availableDiskSpace` → `Paths.availableDiskSpace`.
- `BackupFiles`:
  - rechaza nombres fuera de patrón;
  - `discardPicked` no borra fuera de `Paths.cache`;
  - `sweep` respeta los 15 minutos y deja el `.zip` de seguridad más nuevo;
  - `pruneSafety` conserva solo el indicado.
- `DocumentPicker`: `type: '*/*'`, `copyToCacheDirectory: true`; cancelar → `null`.
- `FileSharer` pasa `mimeType` y `UTI`.
- `PhotoStorage.partialUriFor` / `promotePartial`: id inválido → lanza; destino existente → falla sin sobrescribir.

### 5.5 Casos de uso (`node`, dobles en memoria + base real donde se indica, F8.5 y F8.6)

- **Exportación**:
  - toma el lock y lo libera también si falla;
  - lee una instantánea (la escritura concurrente en otra transacción no se mezcla);
  - `sha256` del disco distinto de la fila → usa el del disco y registra una advertencia sin datos del negocio;
  - archivo faltante → la fila sale borrada lógicamente y sin archivo;
  - el manifiesto tiene los conteos (`activePhotos` = fotos con archivo) y los `sha256` correctos, y lista `data.json` y solo las fotos activas;
  - nombre `kofi-respaldo-AAAA-MM-DD.zip` con la fecha local de `FakeClock` (cerca de la medianoche en las tres zonas);
  - sin espacio → `not_enough_space` sin escribir nada;
  - por encima de los límites → `too_large`;
  - sin menú de compartir → `sharing_unavailable`;
  - un respaldo exportado se prepara y se restaura sin errores en otra base.
- **Preparar**:
  - archivo válido → vista previa, sin escrituras (el `InMemoryArchiveIo` y la base no cambian);
  - un PNG, un texto o un ZIP sin manifiesto → `not_a_backup`;
  - entradas extra o faltantes respecto de `manifest.files` → `entries_mismatch`;
  - cada error de 5.2 llega como su `RestoreError`;
  - el archivo se cierra también al fallar.
- **Confirmar** (base real):
  - comprueba el espacio antes de cualquier escritura;
  - crea el respaldo de seguridad y borra el anterior solo cuando el nuevo está completo (un fallo inyectado al escribir el nuevo deja el anterior);
  - con el lock tomado, copia cada foto a `.part`, verifica y promueve; salta las que existen con el mismo `sha256`; `photo_conflict` si existen con otro; `checksum_mismatch` si la copia no coincide (y borra el `.part`);
  - reemplaza las tablas en una sola transacción y emite `DataChanges` con todas;
  - un error en cualquier paso previo al commit deja la base igual (comparando `readSnapshot` antes y después) y las fotos copiadas quedan solo en disco;
  - las preferencias del dispositivo se mantienen (D-28);
  - el archivo de la fuente cambiado entre la vista previa y la confirmación → `entries_mismatch`;
  - el lock se libera siempre.
- **Integración con notificaciones** (`ui`, `core/dependencies`): con los dobles, una restauración termina en una llamada al reconciliador.
- **Limpieza**: con el lock ocupado no hace nada; respeta los 15 minutos.
- **Emergencia** (F8.8, `DatabaseCopier` falso):
  - el ZIP contiene `info.json`, el `.db` y las fotos;
  - en modo crudo, `-wal` y `-shm`;
  - no hay ninguna llamada de escritura sobre la base de origen;
  - la base de más de 16 MiB se escribe en dos pasadas;
  - el lector rechaza ese ZIP con `invalid_name`.

  `core/db/database-copier.test.ts` (`jest.mock('expo-sqlite')`) comprueba que usa `backupDatabaseAsync` con la base de origen como `sourceDatabase` y que cierra el destino.

### 5.6 Hooks, componentes y screens (`ui`, F8.7 y F8.8)

- El progreso tiene un texto accesible por fase, con "n de m".
- Cada `RestoreError['code']`, `ExportError['code']` y el error inesperado tienen un mensaje en español sin tecnicismos (sin "ZIP", "CRC", "hash", "JSON", "SQL" ni "error"), comprobado también contra `GUILT_PATTERNS`.
- La confirmación es explícita: dice que se reemplaza todo y que se guarda una copia de seguridad.
- Cancelar el selector no muestra un error.
- `restoreFlow`: todas las transiciones; un `confirm` fuera de `preview` se ignora.
- `BootErrorScreen`: la acción aparece en `migration_failed`, `foreign_key_violation` y `newer_database`; muestra el estado; no hay otra acción.

### 5.7 E2E y medición (F8.10, `e2e/maestro/backup/`, pendiente de entorno)

- `export-csv.yaml`: "Exportar ventas" y "Exportar productos" abren el menú de compartir.
- `create-backup.yaml`: "Crear respaldo" abre el menú de compartir.
- `restore-fixture.yaml`: semilla `basic` → los productos y las ventas del *fixture* se ven en Productos y en el resumen del mes del *fixture*.
- `restore-invalid.yaml`: con un archivo que no es un respaldo (empujado con `adb push` a Descargas y elegido en el selector), aparece el mensaje amable.
- **Medición**: tiempo y memoria de exportar y restaurar `large` en el Android de referencia, por fase (`hashing_photos`, `writing` con el CRC32 en JS, `copying_photos`, `applying`). Si supera el presupuesto de F10.0, el architect abre un ADR conservando el formato (por ejemplo, CRC32 de cada foto guardado al importarla, como prevé ADR-012).
- **Manual**: abrir los CSV en Excel y en Google Sheets; comprobar tildes, `ñ`, separador, que los montos se sumen y que una celda `=1+1` se vea como texto.

### 5.8 Semilla (F8.11)

- **Fábricas** (`node`, `src/features/e2e/data/e2e-fixtures.test.ts`):
  - los productos activos pasan `validateProduct`;
  - todo el snapshot pasa `backupDataV1Schema`, `checkIntegrity` y `checkPhotoFiles`;
  - restaurado con `replaceAll` en una base de test, los repositorios reales lo leen sin errores.
- Dos generaciones dan bytes idénticos. `basic.zip` en el repo es igual a lo generado (control de desvío).
- `prepareRestore` acepta `basic` y `large`, con la vista previa esperada.
- **Sin el *flag***: `/e2e/seed` redirige a Inicio (`src/__tests__/navigation.test.tsx`) y `+native-intent` reescribe el enlace. La verificación del bundle `release` (README de Maestro) comprueba que `basic.zip` no aparece en `assets/`.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### 6.1 Técnicas

1. **Condición de parada para F8.11: `expo-asset`.** Para convertir un `.zip` incluido en el bundle en un archivo legible en un build `release` de Android (donde el recurso vive dentro del APK) hace falta `Asset.fromModule(...).downloadAsync()` de **`expo-asset`**. Ya está instalado como dependencia de `expo` (~58.0.21), pero importarlo exige declararlo con `npx expo install expo-asset`, y **ningún ADR lo lista** (regla 0.5 del plan).
   - **Recomendación**: agregarlo con una enmienda de ADR-013 (semillas de E2E) o de ADR-016 (tabla de dependencias). Es parte del SDK de Expo y solo se usa dentro de la rama del *flag*, así que el bundle `release` no lo incluye.
   - Las alternativas son peores: embeber el ZIP en base64 en un módulo TS (inviable para los 50 MB de `large`) o empujarlo con `adb` a una carpeta externa de la app (frágil, y depende de permisos de almacenamiento que hoy están bloqueados).
   - F8.0 a F8.10 no dependen de esto.
2. **Agregados de firma** (no cambian decisiones; conviene anotarlos en ADR-012 y ADR-005 como enmienda fechada):
   - `PhotoStorage.partialUriFor` y `promotePartial`, para que `products` siga siendo el único que conoce `photos/`;
   - `FileSharer.isAvailable`;
   - `SequentialWriter` (ADR-012 lo usa sin definirlo);
   - los puertos `BackupFiles` y `DatabaseCopier`;
   - `FileLockOwner` suma `'backup_cleanup'`.
3. **`data.json` en memoria** en lugar de un temporal en caché (paso 4 de ADR-012). Es un detalle de implementación: los bytes hacen falta igual para el CRC32.
4. **Rendimiento en Hermes**:
   - CRC32 en JS de unos 50 MB (ya previsto en ADR-012);
   - `encodeUtf8` y `decodeUtf8Strict` puros sobre un `data.json` grande;
   - una lectura por encabezado local (unas 200 en `large`; hasta 20.000 en el límite).

   El adaptador puede usar `readBytesSync` para lecturas de pocos bytes. F8.10 mide. Si el códec UTF-8 resulta lento, se cambia su implementación por `TextEncoder`/`TextDecoder` detrás de las mismas funciones, con los mismos tests.
5. **Memoria**: `maxDataJsonBytes` de 32 MiB acota el peor caso (bytes, *string* y objetos). Bajar el límite después dejaría respaldos válidos sin poder restaurarse, así que el valor se fija ahora y F8.10 lo valida en el teléfono de referencia.
6. **Bloqueo de la UI durante el commit**: `replaceAll` es síncrono (ADR-006). Con `large` puede tardar alrededor de un segundo. La UI muestra "aplicando" antes (`yieldToUi`) y no hay progreso dentro del commit.
7. **`FileHandle` no ordena las operaciones asíncronas** (documentado en `File.types.d.ts`). El adaptador serializa cada handle; si no lo hiciera, dos lecturas con `offset` distinto se pisarían.
8. **Semilla con fechas fijas**: los datos de `basic` y `large` no se corren con el día del E2E. Los flujos que la usan verifican meses pasados o conteos. Correr las fechas al restaurar dejaría de probar "el camino real".
9. **Fotos viejas después de restaurar**: quedan huérfanas hasta el próximo arranque (la recolección corre una vez por proceso). Mientras tanto ocupan espacio. Se acepta: forzar una recolección desde `backup` acoplaría las features y la regla de 15 minutos igual las protegería.
10. **Directorio de `openDatabaseAsync`**: F8.8 verifica si `directory` acepta la URI `file://` de `Paths.cache` o necesita la ruta sin esquema.
11. **iOS** no se verifica en la v1 (D-23). La carpeta de copia del selector y la UTI se confirman cuando haya un dispositivo.

### 6.2 De producto (cada una con su valor por defecto, que permite seguir)

1. **¿Se puede restaurar la copia de seguridad desde la app?** D-22 dice que se conserva la última, pero no cómo se usa. **Por defecto**: en F9, Ajustes → Respaldo muestra "Copia de seguridad del <fecha>" con "Restaurar esta copia", que usa el mismo flujo. Antes de restaurar, el archivo se copia a la caché, para que el nuevo respaldo de seguridad pueda reemplazarlo. Alternativa: solo "Compartir la copia de seguridad".
2. **Nombres de los CSV.** **Por defecto**: `ventas.csv` y `productos.csv` (ADR-012). La alternativa `cuantovendi-ventas-AAAA-MM-DD.csv` evita que se pisen o dupliquen al guardarlos varias veces en Drive.
3. **Después de restaurar.** **Por defecto**: mensaje de éxito en la pantalla de respaldo, con "Ir al inicio" (F8.1).
4. **Columna "Archivado" de `productos.csv`.** **Por defecto**: `Sí` si el producto **o** la versión están archivados.
5. **¿El CSV de ventas incluye el costo?** **Por defecto**: no; son las columnas de ADR-012. Agregar "Costo unitario" ayudaría a calcular la ganancia en la planilla, pero muestra un concepto que la app introduce de a poco.
6. **Exportar sin datos.** **Por defecto**: se permite; el respaldo es válido y los CSV traen solo los encabezados.
7. **¿Se versiona `large.zip` (unos 50 MB)?** El plan dice que los *fixtures* se versionan en `e2e/fixtures/`. Cada regeneración sumaría otros 50 MB al historial de git.
   - **Recomendación y valor por defecto**: versionar `basic.zip` (con control de desvío) y **no** versionar `large.zip`; se genera de forma determinista con `npm run e2e:fixtures`, que `e2e:build` ejecuta antes de compilar, y queda en `.gitignore`.
   - Si el orquestador prefiere seguir el texto del plan, se versionan los dos y no cambia el código.
8. **Límites** (`BACKUP_ZIP_LIMITS` y `FREE_SPACE_MARGIN_BYTES`). Son técnicos y nadie debería alcanzarlos. **Por defecto**: los de 3.2 y 3.8, con un mensaje amable si se superan.

### 6.3 Dependencias

- **Nuevas, ya justificadas en ADR-012**: `expo-sharing` ~58.0.23 y `expo-document-picker` ~58.0.5, con `npx expo install`. No hace falta configurar plugins: el de `expo-sharing` solo activa la extensión para *recibir* contenido compartido, que está desactivada por defecto. No se agrega ninguna librería de ZIP ni de CSV.
- **Nueva sin ADR**: `expo-asset` (solo F8.11). Condición de parada (6.1, punto 1).

## Cambios tras la revisión F8.9 (2026-11-14)
- `BackupStore.countActive()` (`count(*)` de filas activas) alimenta la vista previa de `prepareRestore`; ya no se lee el snapshot completo.
- `BackupFiles.clearEmergencyDirectory()`: la exportación de emergencia vacía `cache/emergency/` al empezar, mide el espacio antes de copiar la base y borra las copias en un `finally`.
- `ExportError` suma `inconsistent_data`: la exportación valida `data` con `backupDataV1Schema` y `checkIntegrity` antes de escribir.
- La restauración y la exportación tienen una guarda síncrona contra el doble toque, y `confirmRestore` libera el lock en todo camino.
- El CRC32 de las entradas en memoria se calcula por bloques de 1 MiB cediendo la UI entre bloques; bucle por índice desenrollado (≈ −30 % sin JIT).

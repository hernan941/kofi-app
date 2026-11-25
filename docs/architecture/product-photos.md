# Diseño técnico — Fotos de producto (F2)

- **Tarea**: F2.0 de `docs/plan-v1.md`. Rige F2.2 a F2.9.
- **ADRs**: ADR-005, ADR-006, ADR-007, ADR-008 (principal), ADR-009, ADR-010 y ADR-012 (lock de archivos y `.part`). **Decisiones**: D-05 y D-17. Base: `docs/architecture/products.md` y `docs/architecture/foundations.md` (patrón `TransactionRunner` + escritores síncronos).
- Este documento no cambia ninguna decisión aceptada. Extiende de forma aditiva dos interfaces de ADR-008 (`PhotoPicker` gana la cámara y `PhotoStorage` gana los `.part`) y las interfaces de productos de F1 (`ProductRepository` y `ProductWriter` ganan métodos de fotos). La sección 6 marca lo que el orquestador tiene que resolver.

---

## 1. Resumen del enfoque

- **Importar apenas se elige, guardar la fila al guardar el producto.** Cuando la persona elige fotos (galería o cámara), cada una se procesa enseguida: se redimensiona a 1600 px, se recomprime a JPEG 0,8, se mueve a `photos/<id>.jpg` y se calcula su hash. Después se borran los temporales, que pueden traer GPS. Así el original con EXIF vive en caché el menor tiempo posible, y la vista previa usa el archivo final. La fila en `product_photos` se inserta recién **al guardar el producto**, en la misma transacción que el producto (ADR-008, pasos 1 a 5). Si la persona sale sin guardar, los archivos importados se descartan. Si el descarte no llega a correr, la recolección de huérfanos los limpia.
- **El agregado sigue siendo `Product`.** La lista de fotos deseada (existentes y nuevas, en orden) entra al caso de uso `saveProduct`, que ya existe, como un campo opcional del comando. Un comando puro del dominio (`setProductPhotos`) valida el cupo de 6, los ids y el orden, y asigna las posiciones `0..n-1`. La posición 0 es la portada (D-17). Un `diffPhotos` puro calcula qué filas se insertan, cuáles cambian de posición y cuáles se borran lógicamente.
- **Archivos después del commit.** Los archivos de las fotos quitadas se borran después del commit. Si la transacción falla, **no se borra nada**: los archivos nuevos pertenecen a la sesión del formulario, que los descarta al salir sin guardar (`useRemovePhotoFiles`) o, si ese descarte no corre, la recolección de huérfanos (ajustado en F2.7). Ningún borrado de archivo ocurre dentro de la transacción síncrona.
- **Un lock de archivos en memoria** (`FileLock`) coordina tres operaciones: la recolección de huérfanos, el borrado de archivos y, desde F8, el respaldo y la restauración. El tipo vive en `shared/domain`, como `TransactionRunner`, y la implementación (pura y sin módulos nativos) en `core/files`.
- **Recolección de huérfanos como tarea de arranque.** `AppComposition` suma `runAfterFirstRender`. `MigrationGate` la ejecuta una sola vez por proceso, después del primer render en `ready`, sin bloquearlo y sin que un fallo afecte el arranque. La decisión de qué borrar es la función pura `findOrphans` de ADR-008, con antigüedad mínima de 15 minutos, y se aplica igual a `photos/<id>.jpg.part`. Antes de recolectar, `runAfterFirstRender` barre también `Paths.cache/ImagePicker/` y `Paths.cache/ImageManipulator/` con la misma regla de 15 minutos (F2.7): son temporales que dejó un proceso cerrado antes de limpiar, por ejemplo una captura de cámara pendiente. Recuperar esa captura con `ImagePicker.getPendingResultAsync()` (Android, cuando el sistema destruye la actividad) **no se implementó**: el formulario vive en estado de JS y se pierde con la actividad, así que habría que reabrir el formulario y reconstruir el producto en curso; hoy el barrido borra el temporal y la persona vuelve a tomar la foto. Queda anotado para un futuro si F2.9 muestra que ocurre.
- **Visualización** con `expo-image` (`cachePolicy="memory"`, `recyclingKey` = id de la foto) sobre `photoStorage.uriFor(id)`. Si falta el archivo, se muestra un placeholder neutro y se registra en el logger.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/products/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/photos.ts` | Constantes (`MAX_PHOTOS_PER_PRODUCT = 6`, `PHOTO_MAX_SIDE = 1600`, `PHOTO_JPEG_COMPRESS = 0.8`, `ORPHAN_MIN_AGE_MS = 15 * 60 * 1000`). Funciones puras: `fitWithin`, `remainingPhotoSlots`, `fitSelection`, `findOrphans`, `findMissingFiles`, `orderedPhotos`, `coverPhoto`, `movePhoto`, `makeCover`, `setProductPhotos` y `diffPhotos`. Tipos `StoredPhoto`, `PhotoFileInfo` y `PhotoDiff`. | F2.2 |
| `domain/photos.test.ts` | Tests de F2.2 y los de la sección 5.1. | F2.2 |
| `domain/errors.ts` (existe) | Suma `too_many_photos`, `duplicate_photo` y `photo_not_found` a `PRODUCT_ERROR_CODES`. | F2.2 |
| `domain/index.ts` (existe) | Exporta lo público de `photos.ts`. `tracking` y `sales` usan `coverPhoto` para las miniaturas. | F2.2 |
| `adapters/photo-storage.ts` | Interfaces `PhotoStorage` (ADR-008 + `.part`) y `PhotoPicker` (ADR-008 + cámara), `CameraResult` y la clase `PhotoImportError`. Solo tipos y la clase de error. | F2.3 |
| `adapters/expo-photo-storage.ts` | `createExpoPhotoStorage(logger)`: implementa `PhotoStorage` sobre `expo-image-manipulator` y `expo-file-system` (`File`, `Directory`, `Paths`, `File.digest('SHA-256')`, `modificationTime`). Valida el patrón de UUID de ADR-008 en toda entrada. | F2.3 |
| `adapters/expo-photo-picker.ts` | `createExpoPhotoPicker(logger)`: implementa `PhotoPicker` sobre `expo-image-picker` (`launchImageLibraryAsync`, `launchCameraAsync`, `requestCameraPermissionsAsync`). Recorta con `fitSelection` y borra los temporales que sobran. | F2.3 |
| `adapters/cache-files.ts` | `isCacheUri`, `deleteCacheFile` (único camino para borrar temporales: solo bajo `Paths.cache`) y `sweepStaleCacheFiles` (barrido de `ImagePicker/` e `ImageManipulator/`). | F2.7 |
| `adapters/photo-storage.contract.ts` | Suite de contrato de `PhotoStorage`, común al adaptador de Expo y a `InMemoryPhotoStorage`. | F2.7 |
| `messages/photo-messages.ts` | Textos fijos y anuncios de fotos, probados con `GUILT_PATTERNS`. | F2.7 |
| `adapters/*.test.ts` | Tests con `jest.mock` de los tres módulos (F2.3 y sección 5.2). | F2.3 |
| `data/product-repository.ts` (existe) | `ProductRepository` suma `activePhotoIds()` y `findByIds(ids)` (este lo pide F3, ver `sales.md`). `ProductWriter` suma `savePhotosSync` y `activePhotoIdsSync`. | F2.4 |
| `data/drizzle-product-repository.ts` (existe) | Implementa los métodos nuevos. `savePhotosSync` aplica un `PhotoDiff` e impone en la base el máximo de 6 fotos activas (defensa en profundidad). | F2.4 |
| `data/product-repository.contract.ts` (existe) | Casos de fotos de la sección 5.3, corridos contra Drizzle y contra el doble en memoria. | F2.4 |
| `testing/in-memory-product-repository.ts` (existe) | Implementa los métodos nuevos y emite `product_photos` en `DataChanges`. | F2.4 |
| `testing/in-memory-photo-storage.ts` | Doble de `PhotoStorage`: archivos en un `Map` con `modifiedAt` controlable, fallas inyectables (`failNextImport`), `uriFor` determinista (`file:///test/photos/<id>.jpg`). | F2.4 |
| `testing/fake-photo-picker.ts` | Doble de `PhotoPicker` con respuestas programables (URIs, cancelación y permiso denegado) y registro de llamadas. | F2.5 |
| `use-cases/product-command-deps.ts` (existe) | `ProductCommandDeps` suma `photos: PhotoStorage`, `fileLock: FileLock` y `logger: Logger`. | F2.4 |
| `use-cases/save-product.ts` (existe) | El comando suma `photos?: PhotoChangesInput`. Aplica `setProductPhotos` dentro de la misma `transactions.run`, y después del commit borra los archivos quitados. Si hay rollback no borra nada (F2.7). | F2.4 |
| `use-cases/import-photos.ts` | `importPhotos(deps, uris)`: por cada URI, genera el id, llama a `importFromPicker` en secuencia y devuelve un resultado por foto. Nunca lanza por una foto mala. | F2.4 |
| `use-cases/remove-photo-files.ts` | `removePhotoFiles(deps, ids)`: borra archivos de fotos sin fila activa, con el lock tomado. Si el lock está ocupado, lo deja en espera hasta que se libere. La usan `saveProduct` y el descarte del formulario. | F2.4 |
| `use-cases/collect-orphan-photos.ts` | `collectOrphanPhotos(deps)`: recolección de huérfanos y `.part`, y registro de filas sin archivo. Devuelve un resumen para tests y logs. | F2.4, F2.6 |
| `hooks/use-import-photos.ts` | `useMutation` sobre `importPhotos`. | F2.5 |
| `hooks/use-pick-photos.ts` | `pickFromLibrary(remaining)` y `takePhoto()` del `PhotoPicker` de las dependencias, que se encadenan con la importación. | F2.5 |
| `hooks/use-discard-imported-photos.ts` | Descarta los archivos importados y no guardados al salir del formulario sin guardar (llama a `removePhotoFiles`). | F2.5 |
| `hooks/use-photo-uri.ts` | `usePhotoUri(id)`: `photoStorage.uriFor(id)`. Los componentes no ven el puerto. | F2.5 |
| `components/photo-strip.tsx` | Tira de fotos del formulario (agregar, quitar, reordenar y contador "3 de 6") según F2.1. | F2.5 |
| `components/photo-gallery.tsx` | Tira o galería del detalle, de solo lectura. | F2.5 |
| `components/product-photo.tsx` | `expo-image` con `cachePolicy="memory"`, `recyclingKey`, etiqueta accesible y placeholder ante `onError`. | F2.5 |
| `components/product-form-schema.ts` (existe) | Suma `photos` y `removedPhotoIds` a los valores del formulario y `photos` a la salida (sección 3.7). | F2.5 |
| `components/error-messages.ts` (existe) | Textos de los códigos nuevos y de `PhotoImportErrorCode`. | F2.5 |
| `screens/new-product-screen.tsx`, `edit-product-screen.tsx`, `product-detail-screen.tsx` (existen o los crea F1.6) | Integran la tira y el descarte al salir sin guardar. | F2.5 |
| `index.ts` (existe) | Exporta `collectOrphanPhotos` (para la composición) y los tipos `PhotoStorage`, `PhotoPicker` y `StoredPhoto` (`export type`). | F2.4, F2.6 |

### 2.2 Compartido y núcleo

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/shared/domain/file-lock.ts` | Tipo del puerto `FileLock` y `FileLockOwner`. Lo usan los casos de uso de `products` y, desde F8, de `backup`. Mismo criterio que `transaction-runner.ts`. | F2.4 |
| `src/core/files/file-lock.ts` | `createFileLock()`: implementación pura en memoria (sin `expo-*`), con cola de espera y de "cuando se libere". | F2.4 |
| `src/core/files/file-lock.test.ts` | Tests de la sección 5.4. | F2.4 |
| `src/core/providers/app-dependencies.ts` | `AppDependencies` suma `photos: PhotoStorage`, `photoPicker: PhotoPicker` y `fileLock: FileLock`. `AppComposition` suma `runAfterFirstRender: () => Promise<void>`. | F2.4, F2.6 |
| `src/core/dependencies/create-app-dependencies.ts` | Crea `createFileLock()`, `createExpoPhotoStorage`, `createExpoPhotoPicker` y `runAfterFirstRender`, que llama a `collectOrphanPhotos` con las dependencias reales. | F2.4, F2.6 |
| `src/core/providers/migration-gate.tsx` | Recibe `runAfterFirstRender` por props. Al llegar a `ready` la agenda una sola vez por proceso, fuera del render (efecto + `setTimeout(…, 0)`), y registra en el logger si rechaza. | F2.6 |
| `src/core/providers/app-providers.tsx` | Pasa `runAfterFirstRender` de la composición a `MigrationGate`. | F2.6 |
| `src/core/testing/create-test-dependencies.ts` | Por defecto: `InMemoryPhotoStorage`, `FakePhotoPicker` y `createFileLock()`. | F2.4 |
| `app.json` | Plugin `expo-image-picker` (sección 3.6) y, si la introspección lo exige, `android.blockedPermissions`. | F2.3 |
| `package.json` | `npx expo install expo-image-picker expo-image-manipulator expo-file-system` (las tres están en ADR-008). | F2.3 |
| `tools/photos/check-jpeg-metadata.mjs` + test | Script de desarrollo que recorre los segmentos de un JPEG y reporta APP1 (`Exif`, XMP), APP13 (IPTC) y la presencia de GPS. Se usa en F2.9 (sección 5.8). | F2.3 |
| `e2e/maestro/products/photos-*.yaml`, `e2e/maestro/_shared/` | Flujos de F2.8 y el subflujo para precargar imágenes en el emulador. | F2.8 |

### 2.3 Rutas
No hay rutas nuevas. Las fotos viven dentro de `products/new`, `products/[id]` y `products/[id]/edit`. El designer decide en F2.1 si la vista ampliada de una foto es una ruta (`products/[id]/photos/[photoId]`) o un `Sheet`. Por defecto es un `Sheet`, sin ruta.

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Dominio (`domain/photos.ts`)
```ts
/** Máximo de fotos activas por producto (D-05). */
export const MAX_PHOTOS_PER_PRODUCT = 6;
/** Lado mayor de una foto guardada, en píxeles (ADR-008). */
export const PHOTO_MAX_SIDE = 1600;
/** Calidad JPEG de la recompresión (ADR-008). */
export const PHOTO_JPEG_COMPRESS = 0.8;
/** Antigüedad mínima para borrar un archivo sin fila activa (ADR-008). */
export const ORPHAN_MIN_AGE_MS = 15 * 60 * 1000;

/** Resultado de importar una foto ya procesada y guardada (ADR-008); no hay nombre de archivo (ADR-007). */
export interface StoredPhoto {
  readonly id: ProductPhotoId;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
}

/** Archivo presente en la carpeta de fotos, con su fecha de modificación (ADR-008). */
export interface PhotoFileInfo {
  readonly id: ProductPhotoId;
  readonly modifiedAt: EpochMs;
}

/** Tamaño de salida que entra en `maxSide` conservando la proporción; nunca agranda. Redondea al entero más cercano y no baja de 1. */
export function fitWithin(width: number, height: number, maxSide: number): { readonly width: number; readonly height: number };

/** Cupo que queda: `max(0, MAX_PHOTOS_PER_PRODUCT - activeCount)`. */
export function remainingPhotoSlots(activeCount: number): number;

/** Recorta una selección al cupo; devuelve lo que se conserva y lo que sobra (para borrar sus temporales). */
export function fitSelection<T>(selected: readonly T[], remaining: number): { readonly kept: readonly T[]; readonly dropped: readonly T[] };

/** ADR-008: archivos sin fila activa y con `now - modifiedAt > minAgeMs`. El límite exacto (igual a `minAgeMs`) no se borra. */
export function findOrphans(
  files: readonly PhotoFileInfo[],
  activeIds: ReadonlySet<ProductPhotoId>,
  now: EpochMs,
  minAgeMs: number,
): readonly ProductPhotoId[];

/** Ids con fila activa que no tienen archivo; se registran en el logger (ADR-008). */
export function findMissingFiles(activeIds: ReadonlySet<ProductPhotoId>, files: readonly PhotoFileInfo[]): readonly ProductPhotoId[];

/** Fotos ordenadas por `(position, id)`; tolera posiciones repetidas o con huecos (ADR-007, regla 15). */
export function orderedPhotos(photos: readonly ProductPhoto[]): readonly ProductPhoto[];

/** Portada (D-17): la primera de `orderedPhotos`, o `null` si no hay fotos. */
export function coverPhoto(product: Pick<Product, 'photos'>): ProductPhoto | null;

/** Mueve la foto `id` a `toIndex` (acotado al rango) y devuelve la lista nueva; sin efecto si el id no está. */
export function movePhoto<T extends { readonly id: ProductPhotoId }>(photos: readonly T[], id: ProductPhotoId, toIndex: number): readonly T[];

/** Atajo de D-17: mueve la foto a la posición 0. */
export function makeCover<T extends { readonly id: ProductPhotoId }>(photos: readonly T[], id: ProductPhotoId): readonly T[];

/**
 * Lista deseada de fotos del producto, en orden de pantalla (la primera es la portada).
 * Cada entrada es una foto existente del producto o una recién importada.
 */
export type PhotoChangesInput = readonly StoredPhoto[];

/**
 * Aplica la lista deseada al producto:
 * - las existentes que no están en la lista se quitan (dejan de estar en `photos`);
 * - las nuevas reciben `productId` del producto;
 * - las posiciones quedan `0..n-1` en el orden recibido;
 * - `updatedAt` pasa a `clock.now()` solo si algo cambió.
 * Errores: `too_many_photos` (más de 6, ruta `['photos']`), `duplicate_photo` (id repetido,
 * ruta `['photos', i]`). Un id existente con metadatos distintos de la fila conserva los de
 * la fila: las fotos son inmutables (ADR-008).
 */
export function setProductPhotos(current: Product, desired: PhotoChangesInput, clock: Clock): Result<Product, ProductErrors>;

/** Diferencia por id entre las fotos guardadas y las nuevas; sin cambios, las tres listas van vacías. */
export interface PhotoDiff {
  readonly inserted: readonly ProductPhoto[];
  readonly moved: readonly { readonly id: ProductPhotoId; readonly position: number }[];
  readonly removed: readonly ProductPhotoId[];
}

/** Calcula el `PhotoDiff` entre dos listas de fotos del mismo producto. */
export function diffPhotos(before: readonly ProductPhoto[], after: readonly ProductPhoto[]): PhotoDiff;
```

Notas:
- `createProduct` no cambia: un producto nuevo sin fotos se crea como hoy y, si el comando trae fotos, `saveProduct` aplica después `setProductPhotos` sobre el producto recién creado, en la misma transacción.
- `updateProduct` conserva `current.photos` sin tocarlas. Las fotos cambian solo por `setProductPhotos`.
- **Renumerar** `0..n-1` en cada guardado es intencional: son 6 filas como máximo, y deja un orden estable para el sync. Una foto que mantiene su posición no se actualiza.
- `photo_not_found` queda reservado para `removePhotoFiles` y para la UI de detalle. `setProductPhotos` no lo emite, porque un id desconocido se trata como foto nueva y la base rechaza un id duplicado de otro producto por PK.

### 3.2 Puertos de archivos y selector (`adapters/photo-storage.ts`)
```ts
/** Códigos estables de falla al importar; la UI los traduce. */
export type PhotoImportErrorCode = 'unreadable' | 'write_failed' | 'invalid_id';

/** Falla esperable al importar una foto (ADR-008). */
export class PhotoImportError extends Error {
  readonly code: PhotoImportErrorCode;
  constructor(code: PhotoImportErrorCode, options?: { readonly cause?: unknown });
}

/** Almacenamiento de fotos en `Paths.document/photos/` (ADR-008), con los `.part` de la restauración (ADR-012). */
export interface PhotoStorage {
  /**
   * Decodifica, redimensiona con `fitWithin(…, PHOTO_MAX_SIDE)`, guarda JPEG con
   * `compress: PHOTO_JPEG_COMPRESS`, mueve a `photos/<id>.jpg`, calcula `sha256` y tamaño.
   * En `finally` borra el temporal del selector y la salida del manipulador.
   * @throws PhotoImportError si la imagen no se puede leer o guardar, o si el id no es UUID.
   */
  importFromPicker(sourceUri: string, id: string): Promise<StoredPhoto>;
  /** URI absoluta resuelta en tiempo de ejecución (ADR-008). Lanza si el id no es UUID. */
  uriFor(id: ProductPhotoId): string;
  /** Elimina `photos/<id>.jpg`; no falla si no existe. */
  remove(id: ProductPhotoId): Promise<void>;
  /** Archivos `photos/<uuid>.jpg`; ignora los `.part` sin registrarlos e ignora y registra cualquier otro nombre. */
  listFiles(): Promise<readonly PhotoFileInfo[]>;
  /** Temporales `photos/<uuid>.jpg.part` que dejó una restauración interrumpida (ADR-012). */
  listPartialFiles(): Promise<readonly PhotoFileInfo[]>;
  /** Elimina `photos/<id>.jpg.part`; no falla si no existe. */
  removePartial(id: ProductPhotoId): Promise<void>;
}

/** Lo que devuelve la galería (F2.7): las URIs que caben y cuántas se recortaron; con `droppedCount > 0` el formulario avisa "Agregamos {n}: es el espacio que te quedaba.". */
export interface LibraryPick {
  readonly uris: readonly string[];
  readonly droppedCount: number;
}

/** Resultado de abrir la cámara. */
export type CameraResult =
  | { readonly kind: 'taken'; readonly uri: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'permission_denied'; readonly canAskAgain: boolean };

/**
 * Selector de imágenes del sistema (ADR-008). Devuelve URIs temporales en caché.
 * Se agrega `takePhoto` a la interfaz de ADR-008, que solo traía la galería.
 */
export interface PhotoPicker {
  /** Galería sin permisos; recorta a `maxCount`, borra los temporales sobrantes y dice cuántos recortó. Sin URIs si cancela o si `maxCount` es 0. */
  pickFromLibrary(maxCount: number): Promise<LibraryPick>;
  /** Pide el permiso de cámara solo en este momento y abre `launchCameraAsync`. */
  takePhoto(): Promise<CameraResult>;
}
```

Opciones fijas de `expo-image-picker` (las verifica el test del adaptador):
- Galería: `mediaTypes: ['images']`, `allowsMultipleSelection: maxCount > 1`, `selectionLimit: maxCount`, `exif: false`, `quality: 1`, `allowsEditing: false`.
- Cámara: `mediaTypes: ['images']`, `exif: false`, `quality: 1`, `allowsEditing: false`, `cameraType: back`.
- Antes de `launchCameraAsync`: `getCameraPermissionsAsync()`. Si no está concedido y `canAskAgain`, `requestCameraPermissionsAsync()`. Si queda denegado, se devuelve `permission_denied` sin abrir la cámara.

Notas del adaptador de almacenamiento (F2.3):
- Las rutas se arman **solo** con `new File(Paths.document, 'photos', `${id}.jpg`)` después de validar `id` con `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. El directorio se crea la primera vez (`Directory.create({ idempotent: true })`).
- El tamaño de origen sale del `ImageRef` que entrega el contexto del manipulador. Así no cambia la firma de ADR-008, que recibe solo la URI. `fitWithin` decide el `resize`: si la imagen ya entra, no se redimensiona, pero igual se recodifica para descartar EXIF.
- **Mover** la salida del manipulador (en caché) a `photos/<id>.jpg` con `File.move`. Si el destino ya existe (no debería, porque el id es nuevo), se lanza `write_failed` y no se sobrescribe: las fotos son inmutables.
- El hash es `File.digest('SHA-256')` del archivo final, en hexadecimal en minúsculas (lo exige el `CHECK` de la base). El tamaño es `File.size` del archivo final.
- Si falla cualquier paso posterior a mover el archivo, se borra `photos/<id>.jpg` antes de lanzar el error.

### 3.3 Lock de archivos (`shared/domain/file-lock.ts`)
```ts
/** Quién tiene el lock; sirve para logs y para decidir qué hacer si está ocupado. */
export type FileLockOwner = 'orphan_collection' | 'photo_removal' | 'backup_export' | 'backup_restore';

/** Permiso exclusivo; liberar dos veces no tiene efecto. */
export interface FileLockLease {
  readonly owner: FileLockOwner;
  release(): void;
}

/**
 * Lock en memoria del proceso sobre `photos/` (ADR-008, ADR-012). No es reentrante.
 * Mientras está tomado, la recolección de huérfanos no corre y los borrados de archivos esperan.
 */
export interface FileLock {
  /** Toma el lock si está libre; `null` si está ocupado. */
  tryAcquire(owner: FileLockOwner): FileLockLease | null;
  /** Espera hasta tomar el lock (orden de llegada). Lo usará F8 para respaldar y restaurar. */
  acquire(owner: FileLockOwner): Promise<FileLockLease>;
  isHeld(): boolean;
  /** Ejecuta `task` en cuanto el lock quede libre (de inmediato si ya lo está). Los errores de `task` no rompen la liberación. */
  whenReleased(task: () => void): void;
}
```
`createFileLock()` en `core/files/file-lock.ts` lo implementa sin dependencias. Es una sola instancia por proceso, que crea `createAppDependencies`.

### 3.4 Repositorio (`data/product-repository.ts`, aditivo)
```ts
export interface ProductRepository {
  // …métodos de F1
  /** Ids de todas las fotos con fila activa (`deleted_at IS NULL`), de cualquier producto, también de los archivados. */
  activePhotoIds(): Promise<ReadonlySet<ProductPhotoId>>;
  /** Productos por id en cualquier estado salvo borrado, con sus versiones no borradas y fotos; los ids desconocidos se omiten. Lo usa F3. */
  findByIds(ids: readonly ProductId[]): Promise<readonly Product[]>;
}

export interface ProductWriter {
  // …métodos de F1
  /**
   * Aplica el diff de fotos de un producto: inserta (`created_at = updated_at = now`),
   * actualiza `position` y `updated_at` de las movidas, y pone `deleted_at = now` en las quitadas.
   * @throws {Error} Si el resultado dejaría más de `MAX_PHOTOS_PER_PRODUCT` fotos activas (defensa en profundidad).
   */
  savePhotosSync(productId: ProductId, diff: PhotoDiff, now: EpochMs): void;
  /** Igual que `activePhotoIds`, sincrónico, para decidir dentro de una transacción. */
  activePhotoIdsSync(): ReadonlySet<ProductPhotoId>;
}
```

| Método | Tablas que emite |
|---|---|
| `savePhotosSync` | `product_photos`, solo si el diff no está vacío |
| `saveSync` (F1) | sin cambios: `products` y, si cambió, `product_versions` |

`saveProduct` con fotos y sin otros cambios sigue llamando a `saveSync`, porque `updatedAt` del producto cambia. Emite `products` y `product_photos` en **un** aviso.

### 3.5 Casos de uso
```ts
/** Puertos de los casos de uso de productos (F1 + F2). */
export interface ProductCommandDeps {
  readonly transactions: TransactionRunner;
  readonly products: ProductWriter;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly photos: PhotoStorage;
  readonly fileLock: FileLock;
  readonly logger: Logger;
}

/** Comando de F1 con la lista deseada de fotos; `undefined` = no tocar las fotos. */
export type SaveProductCommand =
  | { readonly kind: 'create'; readonly input: CreateProductInput; readonly photos?: PhotoChangesInput }
  | { readonly kind: 'update'; readonly productId: ProductId; readonly input: UpdateProductInput; readonly photos?: PhotoChangesInput };

/**
 * Igual que en F1, y además:
 * 1. dentro de `transactions.run`: aplica `setProductPhotos` sobre el resultado del comando,
 *    calcula `diffPhotos(antes, después)`, llama a `saveSync` y a `savePhotosSync`;
 * 2. si `run` rechaza: vuelve a lanzar el error original y **no borra archivos** (F2.7). Las fotos
 *    nuevas pertenecen a la sesión del formulario: las descarta `useRemovePhotoFiles` al salir sin
 *    guardar y, si eso no corre, la recolección de huérfanos. Así un reintento de guardar encuentra
 *    los archivos que sus filas necesitan;
 * 3. si el dominio devuelve error: no borra nada (el formulario sigue abierto con esas fotos);
 * 4. si hace commit: `await removePhotoFiles(deps, diff.removed)`, que nunca rechaza.
 */
export function saveProduct(deps: ProductCommandDeps, command: SaveProductCommand): Promise<Result<ProductId, ProductErrors>>;

/** Resultado de importar una URI. */
export type PhotoImportOutcome =
  | { readonly ok: true; readonly photo: StoredPhoto }
  | { readonly ok: false; readonly code: PhotoImportErrorCode };

/** Importa en secuencia (una foto a la vez, para acotar memoria en gama baja). Un error inesperado se registra y se informa como `write_failed`. */
export function importPhotos(
  deps: Pick<ProductCommandDeps, 'ids' | 'photos' | 'logger'>,
  uris: readonly string[],
): Promise<readonly PhotoImportOutcome[]>;

/** Puertos de las operaciones sobre archivos. */
export interface PhotoFileDeps {
  readonly photos: PhotoStorage;
  readonly products: Pick<ProductRepository, 'activePhotoIds'>;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
}

/**
 * Borra los archivos de `ids` que no tienen fila activa. Toma el lock como `photo_removal`;
 * si está ocupado, se reprograma con `whenReleased` y resuelve enseguida. Vuelve a leer
 * `activePhotoIds` justo antes de borrar: una restauración pudo haber reactivado ese id (ADR-012).
 * Nunca rechaza; registra cada falla.
 */
export function removePhotoFiles(deps: PhotoFileDeps, ids: readonly ProductPhotoId[]): Promise<void>;

/** Resumen de una recolección. */
export type OrphanCollectionSummary =
  | { readonly kind: 'skipped'; readonly reason: 'lock_held' }
  | {
      readonly kind: 'done';
      readonly removedFiles: number;
      readonly removedPartials: number;
      readonly missingFiles: number;
      readonly failures: number;
    };

/**
 * ADR-008: con `tryAcquire('orphan_collection')` (si no hay lock, `skipped`), lista archivos
 * y `.part`, lee `activePhotoIds`, aplica `findOrphans` (los `.part` con un conjunto vacío
 * de activos) con `ORPHAN_MIN_AGE_MS`, borra uno por uno, registra con `findMissingFiles`
 * las filas sin archivo y libera el lock en `finally`. Un error de un archivo no detiene a
 * los demás; un error de lectura se propaga como rechazo, después de liberar el lock.
 */
export function collectOrphanPhotos(deps: PhotoFileDeps): Promise<OrphanCollectionSummary>;
```

`saveProduct` recibe `ProductCommandDeps`, que no trae `ProductRepository`. Para `removePhotoFiles` usa un adaptador local, `{ activePhotoIds: async () => deps.products.activePhotoIdsSync() }`, y no amplía los puertos.

### 3.6 Configuración nativa (`app.json`)
```json
[
  "expo-image-picker",
  {
    "photosPermission": false,
    "cameraPermission": "Kofi usa la cámara solo cuando eliges tomar una foto de tu producto.",
    "microphonePermission": false
  }
]
```
- `cameraPermission` llena `NSCameraUsageDescription` en iOS. En Android el permiso `CAMERA` no lleva texto: lo explica la UI antes de pedirlo, si el designer lo decide.
- **Permisos bloqueados (F2.7).** `android.blockedPermissions` suma `SYSTEM_ALERT_WINDOW` (lo agregan las herramientas de desarrollo de React Native y la app no dibuja sobre otras), `VIBRATE` (la app no vibra hoy; F7 puede desbloquearlo si lo necesita) y `ACCESS_NETWORK_STATE` (la app no usa red; `expo-image` y Glide lo piden solo para reintentar cargas remotas, y funcionan sin él). `INTERNET` queda: el cliente de desarrollo lo necesita. `npx expo config --type introspect` solo muestra lo que declara `app.json`; los permisos efectivos del APK release se comprueban con `aapt2 dump permissions` o `apkanalyzer manifest permissions` (F2.9).
- `photosPermission: false` evita declarar acceso a la galería completa (la galería usa el selector del sistema, sin permiso). Así se cumple DT-19.
- F2.3 verifica los permisos efectivos con `npx expo config --type introspect` (o `npx expo prebuild --no-install` en una carpeta temporal fuera del repo) y revisa el `AndroidManifest.xml` resultante. Si aparece `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` o `READ_MEDIA_VIDEO`, se agregan a `android.blockedPermissions`. El reviewer de F2.7 revisa ese resultado.

### 3.7 Formulario (`components/product-form-schema.ts`, aditivo)
```ts
/** Foto en el formulario: existente o recién importada; todo lo que necesita `StoredPhoto`. */
export interface PhotoFormValue {
  /** Id de la foto. No se llama `id` para no chocar con la clave de `useFieldArray`. */
  readonly photoId: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  /** `true` si se importó en esta sesión del formulario y todavía no tiene fila. */
  readonly isNew: boolean;
}

export interface ProductFormValues {
  // …campos de F1
  /** Orden de pantalla; la primera es la portada (D-17). */
  readonly photos: readonly PhotoFormValue[];
}

/** La salida del esquema suma `photos: PhotoChangesInput`; `toSaveProductCommand` la pasa al comando. */
```
- Las importaciones en curso **no** van en los valores del formulario: son estado local (`useState`) de la tira, con su progreso. Cada importación exitosa hace `append` en `photos`. Mientras haya importaciones pendientes, guardar espera a que terminen (el botón muestra el progreso; no se deshabilita, ADR-009).
- Quitar una foto nueva saca la fila de `photos` y llama enseguida a `removePhotoFiles` para su id. Quitar una existente solo la saca de `photos`: el archivo se borra después del commit.
- **Salir sin guardar** (cancelar o volver): la screen llama a `useDiscardImportedPhotos` con los ids `isNew` que no se guardaron. Si guardar terminó con `ok`, no se descarta nada.
- El cupo visible es `remainingPhotoSlots(photos.length + pendingImports)`.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Agregar desde la galería
```
PhotoStrip "Agregar" → elección galería/cámara (F2.1)
  → usePickPhotos.pickFromLibrary(remainingPhotoSlots(n + pendientes))
      → expo-image-picker (selectionLimit) → fitSelection → borra los temporales sobrantes
  → useImportPhotos.mutateAsync(uris) → importPhotos: por cada uri
      id = ids.next() → photos.importFromPicker(uri, id)
        manipulador (caché) → move a photos/<id>.jpg → digest → finally: borra temporales
  → cada ok → append en `photos` (isNew: true) → miniatura con usePhotoUri(id)
  → cada error → mensaje amable por foto (sin culpa); las demás siguen
```

### 4.2 Cámara
```
"Tomar foto" → photoPicker.takePhoto()
  permission_denied → mensaje con "Abrir ajustes" (Linking.openSettings de react-native) y "Ahora no"
  cancelled → nada
  taken → importPhotos([uri]) → igual que 4.1
```

### 4.3 Guardar
```
submit → productFormSchema → saveProduct(deps, { …, photos })
  transactions.run(() => {
    producto = create/update (F1)            → Result
    conFotos = setProductPhotos(producto, photos, clock) → Result
    diff = diffPhotos(guardadas, conFotos.photos)
    productWriter.saveSync(conFotos)          → products [, product_versions]
    productWriter.savePhotosSync(id, diff, now) → product_photos
  })
  rechazo → photos.remove(nuevas) → relanza
  commit → DataChanges.emit({products, product_photos, …}) → invalida ['products']
         → removePhotoFiles(diff.removed)     (lock libre: borra ya; ocupado: espera)
```

### 4.4 Arranque (F2.6)
```
MigrationGate: phase ready → render de hijos → useEffect (una vez por proceso)
  → setTimeout(0) → runAfterFirstRender()
       → collectOrphanPhotos(deps)
            tryAcquire('orphan_collection') ── null → { skipped } (log info)
            listFiles + listPartialFiles + activePhotoIds
            findOrphans(…, ORPHAN_MIN_AGE_MS) → remove / removePartial
            findMissingFiles → logger.warn('photo_file_missing', { count })
            release (finally)
  rechazo → logger.error('after_first_render_failed') ; la app sigue
```

### 4.5 Estado
- **Persistido**: filas en SQLite (TanStack Query, raíz `['products']`, que ya depende de `product_photos`) y archivos en `photos/`. La recolección no toca la base, así que no invalida.
- **Formulario**: `photos` en React Hook Form (`useFieldArray`). Las importaciones pendientes y los errores de cada foto van en `useState` de la tira.
- **Lock**: una instancia en memoria por proceso, en `AppDependencies`. Se pierde al reiniciar, lo que es correcto: una operación interrumpida ya no está en curso, y la regla de 15 minutos protege lo que haya dejado a medias.

---

## 5. Tests que el code-writer escribe primero

Se suman a los de F2.2 a F2.6 del plan y los precisan.

### 5.1 Dominio (`node`, F2.2)
1. `fitWithin`: 4000×3000 → 1600×1200; 3000×4000 → 1200×1600; 2000×2000 → 1600×1600; 800×600 → 800×600 (no agranda); 1601×1 → 1600×1 (nunca 0).
2. `remainingPhotoSlots`: 0 → 6, 6 → 0, 7 (datos rotos) → 0.
3. `fitSelection`: 4 elegidas con cupo 2 → 2 conservadas y 2 sobrantes, en orden; cupo 0 → todas sobran.
4. `findOrphans`: archivo reciente sin fila (no); antiguo sin fila (sí); con fila activa (no); fila borrada lógicamente, que no está en `activeIds` (sí, si es antiguo); exactamente 15 minutos (no); sin huérfanos (vacío).
5. `findMissingFiles`: fila activa sin archivo (sí); con archivo (no).
6. `orderedPhotos`, `coverPhoto` y `movePhoto`/`makeCover`: la portada es la de menor posición; con posiciones repetidas desempata por id; mover al índice 0 la vuelve portada; un índice fuera de rango se acota; un id inexistente no cambia nada.
7. `setProductPhotos`: agrega 2 a un producto con 0 → posiciones 0 y 1 con `productId`; 7 → `too_many_photos`; id repetido → `duplicate_photo`; reordenar → posiciones nuevas y `updatedAt = now`; la misma lista → mismo producto y `updatedAt` sin cambiar; quitar todas → `photos` vacío; un existente con metadatos distintos conserva los de la fila.
8. `diffPhotos`: sin cambios → vacío; una nueva → `inserted`; una quitada → `removed`; un intercambio → dos `moved`.

### 5.2 Adaptadores (`node`, `jest.mock`, F2.3)
9. `importFromPicker`: llama a `resize` con `fitWithin` y a `saveAsync({ compress: 0.8, format: JPEG })`; mueve a `photos/<id>.jpg`; devuelve `StoredPhoto` con `sha256` en minúsculas y `byteSize` del archivo final; borra en `finally` el temporal del selector y la salida del manipulador, también si falla cualquiera de los pasos; un id no UUID → `PhotoImportError('invalid_id')`, sin tocar `photos/` pero borrando el temporal del selector (la validación está dentro del `try`); solo se borran URIs bajo `Paths.cache` (helper único `adapters/cache-files.ts`); los `ImageRef` se liberan justo después de `saveAsync`; `lastModified` se redondea con `Math.floor` antes del esquema; una falla de lectura → `unreadable`; una falla después de mover borra el archivo final.
10. `uriFor` arma la URI con `Paths.document` en cada llamada (cambiar el mock entre llamadas cambia el resultado) y rechaza un id con `../`.
11. `listFiles` devuelve `{ id, modifiedAt }` de los `.jpg` válidos, ignora en silencio los `.part` e ignora y registra `notas.txt` o `../x.jpg`; `listPartialFiles` devuelve solo los `.part` válidos.
12. `remove` y `removePartial` no fallan si el archivo no existe. Una suite de contrato común (`adapters/photo-storage.contract.ts`) corre contra el adaptador y contra `InMemoryPhotoStorage`: todo id se valida como UUID (`invalid_id`), el temporal del selector se consume también cuando el id es inválido y `uriFor`/`remove`/`removePartial` rechazan ids con `../`.
13. `pickFromLibrary`: opciones exactas de 3.2; cancelar → `[]`; `maxCount` 0 → `[]` sin abrir el selector; si el sistema devuelve más que el cupo, se recorta, se borran los sobrantes y `droppedCount` dice cuántos fueron.
14. `takePhoto`: permiso concedido → abre la cámara; no concedido con `canAskAgain` → lo pide; denegado → `permission_denied` sin abrir la cámara; cancelar → `cancelled`.
15. `check-jpeg-metadata`: con un *fixture* JPEG con APP1 Exif y GPS lo reporta; con uno sin metadatos no reporta nada; un archivo que no es JPEG da error.

### 5.3 Datos (`node`, `createTestDatabase`, F2.4)
16. Suite de contrato: `savePhotosSync` inserta, mueve y borra por id, siempre filtrando por `product_id` y `deleted_at IS NULL` (no toca fotos de otro producto) y sin contar como liberado un id quitado que no es una foto activa del producto; `findById` devuelve las fotos activas ordenadas; `activePhotoIds` incluye fotos de productos archivados y excluye las borradas; un diff que dejaría 7 activas lanza y no escribe; `findByIds` incluye archivados y omite desconocidos.
17. Solo Drizzle: `savePhotosSync` emite `product_photos` solo si el diff no está vacío; dentro de `transactions.run` se une a la externa (un aviso con `products` y `product_photos`); `sha256` con mayúsculas viola el `CHECK` (el adaptador nunca lo produce).

### 5.4 Lock (`node`, F2.4)
18. `tryAcquire` devuelve `null` si está tomado; `release` dos veces no tiene efecto; `acquire` espera en orden de llegada; `whenReleased` corre ya si está libre y, si no, al liberar; una tarea de `whenReleased` que lanza no impide liberar ni que corran las demás.

### 5.5 Casos de uso (`node`, base real + `InMemoryPhotoStorage`, F2.4 y F2.6)
19. `saveProduct` (create) con dos fotos nuevas: inserta las filas en la **misma** transacción que el producto (un solo `DataChanges` con `products`, `product_versions` y `product_photos`).
20. Si la transacción falla (un escritor que lanza): no queda ninguna fila, **los archivos de las fotos nuevas se conservan** (F2.7), el rechazo es el error original y el formulario puede reintentar con las mismas fotos.
21. `update` que quita una foto: la fila queda con `deleted_at` y el archivo se borra **después** del commit (el doble registra el orden de las operaciones). Con el lock tomado, el archivo sigue ahí y se borra al liberarlo.
22. Un error del dominio (`too_many_photos`) no escribe, no emite y no borra archivos.
23. Nunca hay más de 6 activas: 6 existentes + 1 nueva → `too_many_photos`; además, la defensa del escritor (5.3, 16).
24. `removePhotoFiles` no borra un id que volvió a tener fila activa entre la programación y la ejecución.
25. `importPhotos`: tres URIs con la segunda que falla → `[ok, error, ok]`, en secuencia (la segunda empieza cuando termina la primera) y con ids distintos.
26. `collectOrphanPhotos`: borra solo los archivos sin fila activa y antiguos; respeta los recientes; borra los `.part` antiguos y conserva los recientes; registra las filas sin archivo; con el lock tomado → `skipped` sin listar; libera el lock también si `listFiles` rechaza; una falla al borrar un archivo no detiene a los demás y cuenta en `failures`.

### 5.6 UI (`ui`, F2.5 y F2.6)
27. `MigrationGate`: `runAfterFirstRender` no se llama antes del primer render de los hijos; se llama una sola vez aunque se remonte; si rechaza, los hijos siguen visibles y queda registrado; en `failed` no se llama.
28. Los del plan (F2.5): con 6 fotos el botón de agregar se reemplaza por un texto; galería y cámara llaman al método correcto de `FakePhotoPicker`; permiso denegado → mensaje amable con "Abrir ajustes" (se verifica la llamada a `Linking.openSettings`); `expo-image` con `recyclingKey` y una etiqueta accesible por foto ("Foto 1 de 3, portada").
29. Contador "3 de 6" que cuenta también las importaciones pendientes; una foto que falla muestra su mensaje y no bloquea las demás.
30. Reordenar y "usar como portada" cambian el orden del formulario; guardar envía `photos` en ese orden.
31. Salir sin guardar descarta los archivos nuevos (llamada a `removePhotoFiles` con esos ids); salir después de guardar no descarta nada.
32. `ProductPhoto` con `onError` muestra el placeholder y registra `photo_file_missing` una sola vez por id.
33. `PRODUCT_ERROR_MESSAGES` cubre los códigos nuevos y hay un texto para cada `PhotoImportErrorCode`.

### 5.7 E2E al cierre (F2.8, `e2e/maestro/products/`, pendiente de entorno)
- `photos-add-from-library.yaml`: precarga imágenes en el emulador (`adb push` a `/sdcard/Pictures` + escaneo de medios, en el subflujo `_shared/seed-gallery-images.yaml`), agrega una, ve "1 de 6" y la portada en la lista.
- `photos-remove.yaml`: quita una foto con confirmación y el contador baja.
- `photos-limit.yaml`: llega a 6 y comprueba que el botón de agregar no está y aparece el texto explicativo.
- `photos-reorder.yaml`: cambia la portada y la ve en la lista.
- F2 no agrega migraciones (la tabla existe desde `0000`), así que no corresponde V-E2E-UPG.

### 5.8 Verificación manual (F2.9): cómo se comprueba la ausencia de EXIF
1. Instalar el build **debug** (`npm run android`), porque `run-as` solo funciona con builds depurables.
2. Tomar una foto con la cámara del teléfono físico, con la ubicación de la cámara activada, y guardar el producto.
3. Copiar el archivo: `adb exec-out run-as com.cuantovendi.local sh -c 'ls -l files/photos && cat files/photos/<id>.jpg' > /tmp/<id>.jpg`. El `<id>` se lee del `ls`. El directorio exacto de `Paths.document` se confirma en F2.3 y queda anotado en `e2e/maestro/README.md`.
4. `node tools/photos/check-jpeg-metadata.mjs /tmp/<id>.jpg` tiene que informar **sin APP1 Exif, sin XMP, sin IPTC y sin GPS**. Si `exiftool` está disponible, `exiftool -a -G1 -gps:all /tmp/<id>.jpg` sirve como segunda opinión y no debe listar nada.
5. Peso entre 150 y 400 KB (`ls -l`) y orientación correcta al abrir el archivo en un visor y en la app.
6. Repetir con una foto de la galería que tenga GPS (tomada antes con la cámara del sistema).

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas (no contradicen ADRs, pero requieren acción o confirmación)
1. **Extensiones aditivas de las interfaces de ADR-008.** `PhotoPicker.takePhoto()` (ADR-008 decide la cámara, pero su interfaz solo trae la galería) y `PhotoStorage.listPartialFiles`/`removePartial` (ADR-008 decide limpiar los `.part`, pero no tiene métodos para eso). No cambian ninguna decisión. Es el mismo criterio que `versionIdsWithSales` en F1.
2. **Dónde vive la cola de borrados mientras el lock está tomado.** ADR-012 dice que "`PhotoStorage.remove` deja los borrados en cola". Este diseño pone esa cola en el caso de uso `removePhotoFiles` (vía `FileLock.whenReleased`) y no en el adaptador, por una razón de corrección: antes de borrar hay que volver a consultar las filas activas, porque una restauración pudo haber reactivado ese id y un borrado ciego eliminaría una foto válida. El adaptador no puede leer la base (ADR-005). El efecto es el que pide ADR-012. Si el orquestador lo considera un cambio y no un detalle, la nota se agrega como aclaración de F8.0.
3. **`FileLock` en `shared/domain`** (solo el tipo), como `TransactionRunner`, para que los casos de uso de `products` y `backup` lo importen sin depender de `core`. La implementación va en `core/files`. Si el lint de capas no permite que `core/dependencies` importe `core/files`, ADR-005 ya lo permite, así que sería un ajuste del lint.
4. **`runAfterFirstRender` en `AppComposition`** y su importación de `collectOrphanPhotos` desde `@/features/products` (el `index.ts` público) en `core/dependencies`. ADR-005 permite que `core/dependencies` importe implementaciones de `data` y `adapters`, pero no menciona los casos de uso. Hay dos alternativas: un componente `PhotoMaintenance` montado por `src/app/_layout.tsx`, o conectar la recolección en `create-app-dependencies` con funciones pasadas por parámetro. Se recomienda `runAfterFirstRender`, que sigue el patrón probado de `migrateDatabase` y que F8 reutiliza para borrar los temporales de respaldo "también al arrancar" (ADR-012, exportación, paso 7). Puede requerir un ajuste del lint.
5. **Decodificación de la imagen completa.** ADR-008 menciona decodificar "con `maxWidth`/`maxHeight`". La API contextual de `expo-image-manipulator` 58 decodifica la imagen al renderizar, y una foto de 12-50 MP de la cámara puede pesar mucho en memoria en un Android de gama baja. F2.3 tiene que confirmar en el código del módulo si existe una opción de decodificación reducida. Si no existe, se mide en F2.9 y F10 (con la foto más grande del teléfono de referencia). Importar en secuencia (3.5) ya acota el problema a una foto por vez.
6. **Permisos que agrega el plugin de `expo-image-picker` en Android.** La configuración de 3.6 se basa en ADR-008. Los permisos efectivos de esta versión se verifican con la introspección de F2.3 antes de cerrar, por DT-19.
7. **Cambios en código de F1** mientras otro code-writer hace la UI de productos: `ProductCommandDeps`, `SaveProductCommand` (campo opcional, compatible), `ProductWriter`/`ProductRepository` (métodos nuevos, que rompen el doble en memoria hasta que F2.4 los implemente), `PRODUCT_ERROR_CODES` (los textos nuevos los exige el test de `error-messages.ts`) y `ProductFormValues`. F2.4 y F2.5 tienen que empezar cuando F1.5 y F1.6 estén cerradas, o coordinarse en esos archivos.
8. **`Linking.openSettings()`** de `react-native` se usa directo en la screen (se prueba con un mock de `react-native`). F7 lo va a necesitar para las notificaciones. Si aparece ese segundo uso, se mueve a `shared/lib`.

### De producto (preguntas; cada una tiene un valor por defecto que permite seguir)
9. **¿Cómo se reordena?** El designer lo especifica en F2.1. Por defecto, sin arrastrar: en la vista de cada foto, "Usar como portada" y "Mover antes/después", que son accesibles con TalkBack. Arrastrar requeriría una librería que no está en ningún ADR.
10. **¿Se pide confirmación al quitar una foto?** F2.1 dice "quitar una foto con confirmación". Por defecto **sí**, también para una foto recién agregada que todavía no se guardó. El borrado real ocurre recién al guardar, y salir sin guardar la conserva.
11. **¿Explicación previa al permiso de cámara?** Por defecto, **no** hay pantalla previa: el permiso se pide al tocar "Tomar foto", que ya deja claro para qué es. Si se deniega, se muestra el mensaje amable con "Abrir ajustes".
12. **Salir del formulario con fotos importadas sin guardar.** Por defecto se descartan sin preguntar, como el resto de los cambios no guardados. Si F1.1 ya define un "¿descartar cambios?", las fotos lo siguen.
13. **Ver una foto en grande en el detalle.** Por defecto **sí**, en un `Sheet` sin ruta, sin zoom ni gestos. El zoom con pellizco requeriría una librería.
14. **Fotos de productos archivados.** ADR-008 ya decide que se conservan. Por defecto el detalle de un archivado las muestra, pero no permite editarlas salvo que se edite el producto (pregunta 18 de `products.md`).

Ninguna pregunta bloquea F2.2 ni F2.3 si se aceptan los valores por defecto. La 9 y la 10 definen tests de F2.5, así que conviene confirmarlas antes de F2.1.

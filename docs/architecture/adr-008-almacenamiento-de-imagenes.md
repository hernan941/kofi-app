# ADR-008: Almacenamiento de imágenes de productos

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas (SDK 58)**:
  - `expo-image-picker` ~58.0.10.
  - `expo-image-manipulator` ~58.0.16: API contextual; la salida se guarda en el directorio de caché.
  - `expo-file-system` ~58.0.13: `File`, `Directory`, `Paths`, `File.digest('SHA-256')` (algoritmos `MD5`, `SHA-1`, `SHA-256`, `SHA-384` y `SHA-512`, verificados en `File.types.d.ts`), `modificationTime` y `Paths.availableDiskSpace`.
  - `expo-image` ~58.0.18.

## Contexto
- Un producto puede tener varias fotos opcionales.
- Las fotos de cámara pesan varios MB y traen EXIF, que puede incluir la ubicación GPS.
- Las fotos tienen que entrar en el respaldo (ADR-012) y, en el futuro, sincronizarse.
- La referencia de rendimiento es Android de gama baja.

## Opciones consideradas

### Dónde guardar
- **BLOB en SQLite**: agranda la base y los respaldos; `expo-image` no puede leer BLOBs sin pasar por base64.
- **Archivos en `Paths.document`**: es persistente, `expo-image` los lee directamente y se pueden copiar sin pasar por JS. La consistencia entre archivo y fila hay que cuidarla en el código.
- **Galería del sistema**: requiere permisos amplios y el usuario puede borrar las fotos desde fuera de la app.
- **`Paths.cache`**: el sistema puede purgarla. Descartado.

### Procesamiento
- **Guardar el original**: archivos pesados que además conservan el GPS.
- **Redimensionar y recomprimir al importar** a una sola versión.
- **Dos tamaños (vista y miniatura)**: duplica los archivos; `expo-image` ya reduce al decodificar.

### Formato
- **JPEG**: se abre en cualquier visor si alguien descomprime el respaldo.
- **WebP**: más liviano, pero menos amigable fuera de la app.

## Decisión
- **Selección**:
  - `expo-image-picker` con `mediaTypes: ['images']`, `allowsMultipleSelection`, `exif: false` y `quality: 1`. La galería no requiere permisos.
  - **Decisión**: también se permite la cámara (`launchCameraAsync`). El permiso se pide solo cuando la persona elige "tomar foto". El plugin declara `cameraPermission` con un texto en español y `microphonePermission: false`.
  - **Decisión**: máximo 6 fotos por producto.
- **Procesamiento** con `expo-image-manipulator`:
  - se decodifica con `maxWidth`/`maxHeight`;
  - se redimensiona a **1600 px en el lado mayor**, sin agrandar;
  - se guarda como **JPEG con `compress: 0.8`**.

  Recodificar descarta el EXIF. Esto y la orientación correcta **se verifican en un dispositivo real** antes de cerrar la feature.
- **Temporales**: tanto el archivo que deja el selector (que puede ser una copia del original **con GPS**) como la salida del manipulador viven en `Paths.cache`. **Ambos se borran** apenas termina la importación, haya funcionado o no (bloque `finally`).
- **Almacenamiento** en `Paths.document/photos/<photoId>.jpg`:
  - **El nombre se deriva siempre del id**; la base no guarda el nombre (ADR-007).
  - `PhotoStorage` valida que todo id que recibe cumpla `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` y, si no, lanza un error.
  - Las URIs absolutas se resuelven en tiempo de ejecución con `uriFor(id)`. En iOS el contenedor cambia de ruta entre instalaciones.
- **Las fotos son inmutables**: editar una foto es crear otra, con id nuevo, y borrar lógicamente la anterior.
- **Metadatos en la fila**: `width`, `height`, `byte_size` y `sha256`, este último calculado con `File.digest('SHA-256')` sobre el archivo final.
- **Orden de escritura**:
  1. Procesar a caché.
  2. Mover a `photos/<id>.jpg`.
  3. Calcular el hash.
  4. Insertar la fila en `runInTransaction`.
  5. Si el paso 4 falla, borrar el archivo.
- **Borrado**: borrado lógico de la fila; el archivo se elimina **después** del commit. Las fotos de productos archivados se conservan.
- **Recolección de huérfanos** al arrancar, después del primer render:
  - Un archivo es huérfano si **no tiene una fila activa con ese id** y **su `modificationTime` tiene más de 15 minutos**. Así no se borra un archivo de una importación o restauración en curso (pasos 2 a 4 de arriba, o la restauración de ADR-012).
  - Además, la recolección **no corre** mientras haya un respaldo o una restauración en curso: un lock en memoria del proceso, que se toma al entrar a esas operaciones.
  - También se eliminan los temporales `photos/<id>.jpg.part` que haya dejado una restauración interrumpida (ADR-012), con la misma regla de antigüedad.
  - Las filas cuyo archivo no existe se muestran con un placeholder y se registran en el logger.
- **Visualización** con `expo-image`:
  - `cachePolicy="memory"`, porque los archivos ya son locales y la caché en disco los duplicaría;
  - `recyclingKey` en las listas;
  - placeholder del sistema de diseño.

```ts
/** Resultado de importar una foto ya procesada y guardada. */
export interface StoredPhoto {
  readonly id: ProductPhotoId;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
}

/** Archivo presente en la carpeta de fotos, con su fecha de modificación. */
export interface PhotoFileInfo {
  readonly id: ProductPhotoId;
  readonly modifiedAt: EpochMs;
}

/**
 * Almacenamiento de fotos de producto en el sistema de archivos de la app.
 * Implementación real en `features/products/adapters/` sobre expo-image-manipulator
 * y expo-file-system. Rechaza ids que no sean UUID.
 */
export interface PhotoStorage {
  /**
   * Redimensiona, recomprime y guarda una imagen elegida por el usuario,
   * y borra los temporales intermedios.
   *
   * @param sourceUri - URI temporal entregada por el selector.
   * @param id - Id de la foto, que determina el nombre del archivo.
   * @throws PhotoImportError si la imagen no se puede leer o guardar.
   */
  importFromPicker(sourceUri: string, id: ProductPhotoId): Promise<StoredPhoto>;
  /** URI absoluta del archivo de la foto, resuelta en tiempo de ejecución. */
  uriFor(id: ProductPhotoId): string;
  /** Elimina el archivo; no falla si ya no existe. */
  remove(id: ProductPhotoId): Promise<void>;
  /** Lista los archivos con nombre válido; ignora y registra los demás. */
  listFiles(): Promise<readonly PhotoFileInfo[]>;
}

/** Selector de imágenes del sistema; devuelve URIs temporales o una lista vacía si cancela. */
export interface PhotoPicker {
  pickFromLibrary(maxCount: number): Promise<{ readonly uris: readonly string[]; readonly droppedCount: number }>;
}

/**
 * Decide qué archivos de fotos se pueden borrar.
 *
 * @param files - Archivos presentes en disco.
 * @param activeIds - Ids de fotos con fila activa.
 * @param now - Instante actual.
 * @param minAgeMs - Antigüedad mínima para considerar huérfano un archivo.
 * @returns Ids de los archivos huérfanos y suficientemente antiguos.
 */
export function findOrphans(
  files: readonly PhotoFileInfo[],
  activeIds: ReadonlySet<ProductPhotoId>,
  now: EpochMs,
  minAgeMs: number,
): readonly ProductPhotoId[];
```

`findOrphans` y `fitWithin(width, height, maxSide)` son funciones puras con tests. Los de `findOrphans` cubren un archivo reciente sin fila, un archivo antiguo sin fila y un archivo con fila.

## Consecuencias
- Cada foto pesa entre 150 y 400 KB aproximadamente.
- Se pierde la resolución original. Conservar originales sería otra feature.
- El respaldo copia `photos/` tal cual. El sync futuro sube los archivos identificados por id y `sha256`.
- Derivar el nombre del id elimina el path traversal desde la base o el respaldo.
- La verificación de EXIF y orientación es manual, en dispositivo.

## Enmienda 2026-11-13 (F2.7)
- `pickFromLibrary` devuelve también `droppedCount`, para avisar cuando la selección se recortó al cupo.
- `discardTemporary` se quitó del puerto: los temporales los borra el selector con un helper que solo actúa bajo `Paths.cache`, y `runAfterFirstRender` barre `ImagePicker/` e `ImageManipulator/` con la regla de 15 minutos.
- Si la transacción de guardado falla, los archivos importados no se borran: pertenecen a la sesión del formulario (ver `product-photos.md` §3.5).

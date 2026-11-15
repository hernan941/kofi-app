# ADR-012: Respaldo, restauración y exportación CSV

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13: se rehízo la parte de ZIP y restauración tras la revisión del reviewer)
- **Versiones verificadas**: `expo-file-system` ~58.0.13 (`FileHandle` con `offset` posicionable, `readBytes`/`writeBytes`; `File.digest('SHA-256')`; `Paths.availableDiskSpace`), `expo-crypto` ~58.0.8 (`digest` sobre bytes), `expo-sharing` ~58.0.23, `expo-document-picker` ~58.0.5, `expo-sqlite` ~58.0.17.
- **Descartadas tras revisar el código fuente**:
  - **`fflate` 0.8.3**: `Zip.add` escribe **siempre** un data descriptor (`0x08074b50`). Al leer en streaming, `Unzip.push` busca firmas `PK` byte a byte dentro de los datos. Un JPEG guardado sin comprimir que contenga `PK\x03\x04`, `PK\x07\x08` o `PK\x01\x02` corta la entrada.
  - **`react-native-zip-archive` 9.5.3**: escribe directo a disco al descomprimir, sin control nuestro de nombres ni tamaños.
  - **`jszip`**: trabaja todo en memoria.

## Contexto
- **CSV** de ventas y productos.
- **Respaldo completo** (datos e imágenes), compartido con el menú del sistema, y **restauración** desde ese archivo.
- El archivo de respaldo es **entrada no confiable**.
- El formato tiene que durar años.

## Opciones consideradas

### Contenido
| Opción | Pros | Contras |
|---|---|---|
| Copia del `.db` + fotos | Exacta. | Acopla el formato al esquema interno. Un `.db` manipulado puede traer triggers o vistas. Difícil de validar. |
| `.db` con fotos como BLOB | No necesita ZIP. | Los mismos problemas, y es pesado. |
| **ZIP con `manifest.json` + `data.json` + `photos/`** | Formato propio, documentado y validable al 100 % con Zod. | Necesita leer y escribir ZIP. |

### ZIP
| Opción | Pros | Contras |
|---|---|---|
| fflate | JS puro, streaming. | Data descriptors al escribir y búsqueda de firmas al leer: **incorrecto** con datos binarios guardados sin comprimir. Lento en Hermes. |
| react-native-zip-archive | Nativo y rápido. | Sin control de nombres ni de tamaños; agrega plugin nativo. |
| **Lector y escritor propios, solo STORED** | Formato mínimo y totalmente controlado. Lectura por **directorio central** con acceso aleatorio. Sin data descriptors. Parser puro testeable con fixtures adversariales. | Es código propio (chico) que mantener. El CRC32 se calcula en JS al escribir. |

## Decisión

### Formato de respaldo v1 (se mantiene)
Archivo `cuantovendi-respaldo-AAAA-MM-DD.zip`, **todo STORED** (método 0, sin compresión: los JPEG no se comprimen más), sin data descriptors, sin ZIP64, sin comentario, con nombres UTF-8 (bit 11):

```
manifest.json
data.json
photos/<photoId>.jpg
```

```ts
/** Manifiesto del respaldo; se lee y valida antes que cualquier otra entrada. */
export interface BackupManifestV1 {
  readonly format: 'cuantovendi-backup';
  readonly formatVersion: 1;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly counts: {
    readonly products: number;
    readonly saleRecords: number;
    readonly activePhotos: number;
  };
  readonly files: readonly {
    readonly path: string;
    readonly byteSize: number;
    readonly sha256: string;
  }[];
}

/**
 * Datos del respaldo en formato propio (camelCase, códigos estables),
 * independiente del esquema SQLite. Incluye filas archivadas y borradas
 * lógicamente, para que la restauración sea fiel.
 */
export interface BackupDataV1 {
  readonly products: readonly BackupProductV1[];
  readonly productVersions: readonly BackupProductVersionV1[];
  readonly productPhotos: readonly BackupProductPhotoV1[];
  readonly saleRecords: readonly BackupSaleRecordV1[];
  readonly saleItems: readonly BackupSaleItemV1[];
  readonly noSalesWeeks: readonly BackupNoSalesWeekV1[];
  readonly tipViews: readonly BackupTipViewV1[];
}
```

- `manifest.files` lista `data.json` y **solo las fotos activas** (`deletedAt` nulo), cada una con su archivo. `counts.activePhotos` es esa cantidad.
- Las filas de fotos borradas lógicamente viajan en `data.json`, **sin archivo**, y no se exige que lo tengan.
- Las preferencias de notificación no se incluyen: son propias del dispositivo.
- **Versionado**: `formatVersion` es un entero independiente de las migraciones. Cada versión tiene su esquema Zod *strict* y una función pura `upgradeVnToVn+1`. Una versión mayor que la soportada se rechaza con un mensaje amable. En el repo se guardan fixtures de cada versión.

### Módulo ZIP (`features/backup/domain/zip/`, puro) + adaptador de E/S
```ts
/** Entrada del directorio central ya validada. */
export interface ZipEntry {
  readonly path: string;
  readonly crc32: number;
  readonly size: number;
  readonly localHeaderOffset: number;
  readonly dataOffset: number;
}

/** Límites que el lector aplica antes de leer datos. */
export interface ZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxDataJsonBytes: number;
}

/** Errores de formato del lector, sin E/S. */
export type ZipFormatError =
  | 'not_a_zip'
  | 'unsupported_feature'
  | 'compressed_entry'
  | 'invalid_name'
  | 'duplicate_entry'
  | 'overlapping_entries'
  | 'out_of_bounds'
  | 'header_mismatch'
  | 'too_large';

/**
 * Localiza y valida el registro de fin de directorio central. Exige que esté
 * al final exacto del archivo, sin comentario, en un solo disco y sin ZIP64.
 */
export function parseEndOfCentralDirectory(
  tail: Uint8Array,
  archiveSize: number,
): Result<{ readonly cdOffset: number; readonly cdSize: number; readonly entryCount: number }, ZipFormatError>;

/**
 * Valida el directorio central completo: método 0, tamaño comprimido igual al
 * descomprimido, sin cifrado ni data descriptor, sin campos extra, nombres en
 * la lista blanca, sin duplicados y dentro de los límites.
 */
export function parseCentralDirectory(
  cd: Uint8Array,
  entryCount: number,
  limits: ZipLimits,
): Result<readonly Omit<ZipEntry, 'dataOffset'>[], ZipFormatError>;

/**
 * Valida un encabezado local contra su entrada del directorio central y
 * calcula dónde empiezan los datos.
 */
export function resolveLocalHeader(
  header: Uint8Array,
  entry: Omit<ZipEntry, 'dataOffset'>,
): Result<ZipEntry, ZipFormatError>;

/** Verifica que los rangos de datos no se solapen y queden antes del directorio central. */
export function checkLayout(entries: readonly ZipEntry[], cdOffset: number): Result<void, ZipFormatError>;

/** CRC32 incremental (IEEE), puro. */
export function crc32(previous: number, chunk: Uint8Array): number;

/** Codifica un encabezado local STORED con CRC y tamaños ya conocidos. */
export function encodeLocalHeader(path: string, crc: number, size: number): Uint8Array;

/** Codifica el directorio central y el registro de fin para las entradas escritas. */
export function encodeCentralDirectory(entries: readonly ZipEntry[]): Uint8Array;

/** Lectura con acceso aleatorio de un archivo local. */
export interface RandomAccessFile {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  close(): void;
}

/**
 * E/S de archivos para respaldos. Adaptador delgado sobre `FileHandle` de
 * expo-file-system en `features/backup/adapters/`; toda la lógica de formato
 * vive en las funciones puras de arriba.
 */
export interface ArchiveIo {
  openForRead(uri: string): Promise<RandomAccessFile>;
  createForWrite(uri: string): Promise<SequentialWriter>;
  copyRange(source: RandomAccessFile, offset: number, length: number, targetUri: string): Promise<void>;
  sha256OfFile(uri: string): Promise<string>;
  sha256OfBytes(bytes: Uint8Array): Promise<string>;
  availableDiskSpace(): number;
}
```

- **Lista blanca de nombres**: `manifest.json`, `data.json` y `^photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$`. Cualquier otro nombre aborta: incluidos `..`, `/` inicial, `\`, NUL y directorios.
- **Fixtures adversariales** (tests del parser):
  - datos de foto que contienen las firmas `PK\x03\x04`, `PK\x07\x08` y `PK\x01\x02`;
  - entradas comprimidas (método 8);
  - flag de data descriptor;
  - ZIP64 (valores centinela `0xFFFFFFFF`);
  - nombres con path traversal y duplicados (también por mayúsculas);
  - entradas solapadas o fuera de límites;
  - discrepancia entre el encabezado local y el central;
  - archivo truncado, con comentario, con dos EOCD o con más entradas que el límite;
  - campos extra.
- **Escritura**: cada entrada se lee completa (una foto pesa como máximo unos pocos MB, ADR-008; `data.json` está acotado), se calcula su CRC32 en JS y se escriben el encabezado local con los valores reales y los datos. Al final se escriben el directorio central y el EOCD. La memoria queda acotada por la entrada más grande.
- **Lectura**: se lee el EOCD desde el final, después el directorio central y los encabezados locales, y se valida todo **antes** de copiar datos. Después se accede a cada entrada por su offset.
  - La integridad de las fotos se verifica con **`sha256` nativo** contra el manifiesto, y no con CRC32 en JS, para no recorrer decenas de MB en Hermes.
  - `manifest.json` (que no tiene hash propio) y `data.json` se verifican además con CRC32, porque son chicos.

### Exportación
1. Tomar el **lock de archivos** (ADR-008). Mientras está tomado, la limpieza de huérfanos no corre y `PhotoStorage.remove` deja los borrados en cola hasta liberarlo.
2. Leer una instantánea consistente (lecturas dentro de una transacción) y mapear a `BackupDataV1`.
3. Para cada foto activa, **calcular su `sha256` desde el disco** con `File.digest`. Si no coincide con la fila, se usa el del disco y se registra una advertencia. Si el archivo ya no existe, la foto se exporta como fila sin archivo, marcada como borrada lógicamente en el respaldo, y se registra.
4. Escribir `data.json` en un archivo de caché, **después** calcular su hash y armar el manifiesto.
5. Escribir el ZIP en `Paths.cache/backups/`.
6. Compartir con `expo-sharing` (`application/zip`, UTI `public.zip-archive`).
7. Liberar el lock y borrar el temporal (también al arrancar, si quedó alguno).

### Restauración
1. Elegir el archivo con `expo-document-picker` (`copyToCacheDirectory: true`), aceptando **cualquier tipo MIME** (`*/*`), porque los proveedores informan `application/octet-stream` u otros. Se valida por contenido: los primeros 4 bytes deben ser `PK\x03\x04`.
2. Aplicar límites al tamaño del archivo. Parsear y validar el EOCD, el directorio central y los encabezados locales. Exigir **STORED** y contar los bytes reales por rango.
3. Leer y validar el manifiesto (Zod *strict*). Exigir que **las entradas del ZIP sean exactamente** `manifest.json` más `manifest.files`, con los mismos tamaños.
4. Leer `data.json`, verificar su `sha256`, validarlo con Zod *strict*, aplicar las funciones de actualización de formato y verificar la integridad referencial. Cada foto **activa** debe tener su archivo; las borradas no lo necesitan. Un archivo de foto sin fila activa es error.
5. Mostrar la vista previa y pedir confirmación.
6. Verificar el **espacio libre** (`Paths.availableDiskSpace`): debe alcanzar para las fotos nuevas, el respaldo de seguridad y un margen.
7. Hacer un **respaldo de seguridad** de los datos actuales en `Paths.document/safety/`. **Se conserva solo el último**: el anterior se borra cuando el nuevo se completa.
8. Tomar el lock de archivos y **copiar las fotos verificadas directamente a `photos/` antes del commit**:
   - si `photos/<id>.jpg` ya existe con el mismo `sha256`, se salta;
   - si existe con otro `sha256`, se aborta con `photo_conflict`, porque las fotos son inmutables y ese estado indica un respaldo manipulado;
   - si no existe, se copia a `photos/<id>.jpg.part`, se verifica el `sha256` y se renombra.

   Nada de esto pasa por `Paths.cache`, que el sistema puede purgar.
9. En una sola `runInTransaction`: borrado físico de las tablas de hijos a padres y luego inserción de padres a hijos. Es la excepción documentada en ADR-006.
10. Liberar el lock. Las fotos anteriores que ya no se referencian, y los `.part` que hayan quedado de un corte, los elimina la limpieza de huérfanos (ADR-008).
11. Emitir `DataChanges` con todas las tablas y reconciliar las notificaciones.

**Fallos**:
- Si algo falla en los pasos 1 a 8, los datos actuales quedan intactos. Las fotos ya copiadas son huérfanas y se limpian solas.
- El paso 9 es atómico gracias a SQLite.
- No hay cambio de directorios ni marcadores de estado.

```ts
/** Errores esperables al restaurar, traducidos a mensajes amables en la UI. */
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
```

### CSV
- **Dos exportaciones separadas**, con botones "Exportar ventas" y "Exportar productos":
  - `ventas.csv`: una fila por ítem (fecha, id del registro, producto, versión, cantidad, precio unitario, subtotal, dónde vendiste, nota);
  - `productos.csv`: una fila por versión (producto, versión, precio o "a convenir", costo, archivado).
- **Formato**:
  - UTF-8 con BOM;
  - separador `;`;
  - CRLF y comillas según RFC 4180;
  - montos como enteros sin símbolo;
  - fechas `AAAA-MM-DD`;
  - encabezados en español.
- **Inyección de fórmulas**: toda celda que empiece con `=`, `+`, `-`, `@`, tabulación o retorno de carro se prefija con `'`.
- **Serializador propio y puro**, sin `papaparse`, porque la app solo escribe CSV (YAGNI).

### Decisiones tomadas sobre las preguntas abiertas (aprobadas con los ADRs)
- La restauración **reemplaza todo**; no se fusionan datos.
- Los respaldos **no se cifran** en v1.
- Los CSV se exportan por separado, con separador `;`.

## Consecuencias
- El formato es un contrato público y versionado, con fixtures de cada versión.
- El lector y el escritor ZIP son código propio y chico, con un parser puro testeado contra entradas adversariales. Reemplazarlo por una librería en el futuro no cambia el formato.
- La restauración no toca nada actual hasta el commit final, y no depende de la caché purgable.
- **Riesgo a medir**: el CRC32 en JS al exportar unos 50 MB en un Android de gama baja. Si no es aceptable, el CRC32 de cada foto se calcula y guarda al importarla (columna nueva por migración) y el escritor lo reutiliza.
- Se agregan `expo-sharing` y `expo-document-picker` (módulos de Expo). No se agrega ninguna librería de ZIP.

## Enmienda 2026-11-13 (F8.0)
Agregados de firma aceptados por el orquestador (detalle en `docs/architecture/backup.md`): `PhotoStorage.partialUriFor` y `promotePartial`, `FileSharer.isAvailable`, `SequentialWriter`, los puertos `BackupFiles` y `DatabaseCopier`, el dueño `'backup_cleanup'` del lock y `isCacheUri` en `core/files`. `data.json` se arma en memoria. Los fixtures E2E: `basic.zip` se versiona; `large.zip` (~50 MB) se genera de forma determinista con `npm run e2e:fixtures` y no se versiona.

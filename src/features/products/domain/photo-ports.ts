import type { ProductPhotoId } from '@/shared/domain';

import type { PhotoFileInfo, StoredPhoto } from './photos';

/** Códigos estables de falla al importar; la UI los traduce. */
export type PhotoImportErrorCode = 'unreadable' | 'write_failed' | 'invalid_id';

/** Falla esperable al importar una foto (ADR-008). */
export class PhotoImportError extends Error {
  readonly code: PhotoImportErrorCode;

  constructor(code: PhotoImportErrorCode, options?: { readonly cause?: unknown }) {
    super(`Photo import failed: ${code}`, options);
    this.name = 'PhotoImportError';
    this.code = code;
  }
}

/** Almacenamiento de fotos en `Paths.document/photos/` (ADR-008), con los `.part` de la restauración (ADR-012). */
export interface PhotoStorage {
  /**
   * Decodifica, redimensiona con `fitWithin(…, PHOTO_MAX_SIDE)`, guarda JPEG con
   * `compress: PHOTO_JPEG_COMPRESS`, mueve a `photos/<id>.jpg`, calcula `sha256` y tamaño.
   * En `finally` borra el temporal del selector y la salida del manipulador.
   * El temporal se borra también cuando el id no es válido. Recibe el id como texto porque
   * el adaptador es quien lo valida y lo convierte en `ProductPhotoId`.
   * @throws {PhotoImportError} Si la imagen no se puede leer o guardar, o si el id no es UUID.
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

/** Resultado de abrir la cámara. */
export type CameraResult =
  | { readonly kind: 'taken'; readonly uri: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'permission_denied'; readonly canAskAgain: boolean };

/** Lo que devuelve la galería: las URIs que caben y cuántas se recortaron por falta de cupo. */
export interface LibraryPick {
  readonly uris: readonly string[];
  readonly droppedCount: number;
}

/**
 * Selector de imágenes del sistema (ADR-008). Devuelve URIs temporales en caché.
 * Se agrega `takePhoto` a la interfaz de ADR-008, que solo traía la galería.
 */
export interface PhotoPicker {
  /**
   * Galería sin permisos; recorta a `maxCount`, borra los temporales sobrantes y dice cuántos
   * recortó (`droppedCount`). Sin URIs si cancela o si `maxCount` es 0.
   */
  pickFromLibrary(maxCount: number): Promise<LibraryPick>;
  /** Pide el permiso de cámara solo en este momento y abre `launchCameraAsync`. */
  takePhoto(): Promise<CameraResult>;
}

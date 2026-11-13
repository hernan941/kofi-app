import { productPhotoIdSchema, type EpochMs, type ProductPhotoId } from '@/shared/domain';

import {
  PhotoImportError,
  type PhotoFileInfo,
  type PhotoImportErrorCode,
  type PhotoStorage,
  type StoredPhoto,
} from '../domain';

/** Opciones de {@link InMemoryPhotoStorage}. */
export interface InMemoryPhotoStorageOptions {
  /** Fuente del `modifiedAt` de los archivos importados. */
  readonly now?: () => EpochMs;
}

const PHOTO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requirePhotoId(candidate: string): ProductPhotoId {
  const parsed = PHOTO_ID_PATTERN.test(candidate)
    ? productPhotoIdSchema.safeParse(candidate)
    : null;
  if (!parsed?.success) {
    throw new PhotoImportError('invalid_id');
  }
  return parsed.data;
}

const IMPORTED_SIZE = { width: 1200, height: 800, byteSize: 2048 } as const;

/**
 * Doble en memoria de {@link PhotoStorage}: archivos en un `Map` con `modifiedAt` controlable,
 * fallas inyectables y un registro ordenado de operaciones (`operations`) para verificar el
 * orden de los borrados.
 */
export class InMemoryPhotoStorage implements PhotoStorage {
  /** Registro de operaciones: `import:start:<uri>`, `import:end:<uri>`, `remove:<id>`, etc. */
  readonly operations: string[] = [];
  /** Temporales del selector que el doble consumió (se borran con éxito o con falla). */
  readonly deletedSources: string[] = [];
  private readonly files = new Map<ProductPhotoId, EpochMs>();
  private readonly partials = new Map<ProductPhotoId, EpochMs>();
  private readonly failingRemovals = new Set<ProductPhotoId>();
  private readonly importFailures: PhotoImportErrorCode[] = [];
  private readonly failingUris = new Map<string, PhotoImportErrorCode>();
  private readonly now: () => EpochMs;
  private listFailure: Error | null = null;

  constructor(options: InMemoryPhotoStorageOptions = {}) {
    this.now = options.now ?? (() => 0 as EpochMs);
  }

  /** Hace que la próxima importación falle con ese código. */
  failNextImport(code: PhotoImportErrorCode): void {
    this.importFailures.push(code);
  }

  /** Hace que la importación de esa URI falle siempre con ese código. */
  failImportOf(uri: string, code: PhotoImportErrorCode): void {
    this.failingUris.set(uri, code);
  }

  /** Hace que `remove` de ese id rechace. */
  failRemovalOf(id: ProductPhotoId): void {
    this.failingRemovals.add(id);
  }

  /** Hace que `listFiles` rechace con ese error. */
  failListing(error: Error): void {
    this.listFailure = error;
  }

  /** Agrega un archivo con la fecha de modificación dada. */
  addFile(id: ProductPhotoId, modifiedAt: EpochMs): void {
    this.files.set(id, modifiedAt);
  }

  /** Agrega un temporal `.part` con la fecha de modificación dada. */
  addPartial(id: ProductPhotoId, modifiedAt: EpochMs): void {
    this.partials.set(id, modifiedAt);
  }

  hasFile(id: ProductPhotoId): boolean {
    return this.files.has(id);
  }

  hasPartial(id: ProductPhotoId): boolean {
    return this.partials.has(id);
  }

  fileIds(): readonly ProductPhotoId[] {
    return [...this.files.keys()];
  }

  async importFromPicker(sourceUri: string, candidate: string): Promise<StoredPhoto> {
    this.operations.push(`import:start:${sourceUri}`);
    await Promise.resolve();
    this.deletedSources.push(sourceUri);
    const id = this.requireId(candidate, sourceUri);
    const code = this.importFailures.shift() ?? this.failingUris.get(sourceUri);
    if (code !== undefined) {
      this.operations.push(`import:end:${sourceUri}`);
      throw new PhotoImportError(code);
    }
    this.files.set(id, this.now());
    this.operations.push(`import:end:${sourceUri}`);
    return { id, ...IMPORTED_SIZE, sha256: 'a'.repeat(64) };
  }

  private requireId(candidate: string, sourceUri: string): ProductPhotoId {
    try {
      return requirePhotoId(candidate);
    } catch (error) {
      this.operations.push(`import:end:${sourceUri}`);
      throw error;
    }
  }

  uriFor(id: ProductPhotoId): string {
    return `file:///test/photos/${requirePhotoId(id)}.jpg`;
  }

  remove(id: ProductPhotoId): Promise<void> {
    try {
      requirePhotoId(id);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    this.operations.push(`remove:${id}`);
    if (this.failingRemovals.has(id)) {
      return Promise.reject(new Error(`Cannot remove ${id}`));
    }
    this.files.delete(id);
    return Promise.resolve();
  }

  listFiles(): Promise<readonly PhotoFileInfo[]> {
    this.operations.push('listFiles');
    if (this.listFailure !== null) {
      return Promise.reject(this.listFailure);
    }
    return Promise.resolve(toInfos(this.files));
  }

  listPartialFiles(): Promise<readonly PhotoFileInfo[]> {
    return Promise.resolve(toInfos(this.partials));
  }

  removePartial(id: ProductPhotoId): Promise<void> {
    try {
      requirePhotoId(id);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    this.operations.push(`removePartial:${id}`);
    this.partials.delete(id);
    return Promise.resolve();
  }
}

function toInfos(source: ReadonlyMap<ProductPhotoId, EpochMs>): readonly PhotoFileInfo[] {
  return [...source].map(([id, modifiedAt]) => ({ id, modifiedAt }));
}

/** Id de foto válido derivado de un número, para los tests. */
export function testPhotoId(n: number): ProductPhotoId {
  return productPhotoIdSchema.parse(`22222222-2222-7222-8222-${n.toString().padStart(12, '0')}`);
}

import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { epochMsSchema, productPhotoIdSchema, type ProductPhotoId } from '@/shared/domain';
import type { Logger } from '@/shared/lib/logger';

import {
  PHOTO_JPEG_COMPRESS,
  PHOTO_MAX_SIDE,
  fitWithin,
  type PhotoFileInfo,
  type StoredPhoto,
} from '../domain/photos';
import { deleteCacheFile } from './cache-files';
import { PhotoImportError, type PhotoStorage } from './photo-storage';

const PHOTOS_DIRECTORY = 'photos';
const PHOTO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_FILE_PATTERN = /^([0-9a-f-]{36})\.jpg$/;
const PARTIAL_FILE_PATTERN = /^([0-9a-f-]{36})\.jpg\.part$/;
const PARTIAL_SUFFIX = '.part';

function photosDirectory(): Directory {
  return new Directory(Paths.document, PHOTOS_DIRECTORY);
}

function parsePhotoId(candidate: string): ProductPhotoId | null {
  if (!PHOTO_ID_PATTERN.test(candidate)) {
    return null;
  }
  const parsed = productPhotoIdSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function requirePhotoId(candidate: string): ProductPhotoId {
  const id = parsePhotoId(candidate);
  if (id === null) {
    throw new PhotoImportError('invalid_id');
  }
  return id;
}

function photoFile(candidate: string): File {
  return new File(Paths.document, PHOTOS_DIRECTORY, `${requirePhotoId(candidate)}.jpg`);
}

function partialFile(candidate: string): File {
  return new File(
    Paths.document,
    PHOTOS_DIRECTORY,
    `${requirePhotoId(candidate)}.jpg${PARTIAL_SUFFIX}`,
  );
}

/** Runs synchronous work and reports its result, or its failure, as a promise. */
function attempt<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

function releaseQuietly(object: { release(): void } | null): void {
  try {
    object?.release();
  } catch {
    return;
  }
}

/**
 * Renders the image decoded under the size cap and, if it still exceeds the limit, resizes it
 * with `fitWithin`. Any failure here means the image could not be read.
 */
async function renderFitted(sourceUri: string, held: { release(): void }[]): Promise<ImageRef> {
  const context = ImageManipulator.manipulate(sourceUri, {
    maxWidth: PHOTO_MAX_SIDE,
    maxHeight: PHOTO_MAX_SIDE,
  });
  held.push(context);
  const decoded = await context.renderAsync();
  held.push(decoded);
  const target = fitWithin(decoded.width, decoded.height, PHOTO_MAX_SIDE);
  if (target.width === decoded.width && target.height === decoded.height) {
    return decoded;
  }
  const resizing = ImageManipulator.manipulate(decoded).resize(target);
  held.push(resizing);
  const resized = await resizing.renderAsync();
  held.push(resized);
  return resized;
}

/**
 * Crea el almacenamiento de fotos sobre `expo-image-manipulator` y `expo-file-system`
 * (ADR-008). Las rutas se arman solo desde un id validado como UUID y nunca se guarda ni se
 * devuelve un nombre de archivo (ADR-007).
 */
export function createExpoPhotoStorage(logger: Logger): PhotoStorage {
  function deleteFinal(file: File): void {
    try {
      deleteIfExists(file);
    } catch (error) {
      logger.warn('photo_file_cleanup_failed', { error: String(error) });
    }
  }

  function deleteIfExists(file: File): void {
    if (file.exists) {
      file.delete();
    }
  }

  async function moveIntoPlace(outputUri: string, id: ProductPhotoId): Promise<File> {
    photosDirectory().create({ idempotent: true, intermediates: true });
    const destination = photoFile(id);
    if (destination.exists) {
      throw new Error('The photo file already exists and photos are immutable.');
    }
    await new File(outputUri).move(destination);
    return destination;
  }

  async function describeStored(
    file: File,
    id: ProductPhotoId,
    size: { readonly width: number; readonly height: number },
  ): Promise<StoredPhoto> {
    const sha256 = (await file.digest('SHA-256')).toLowerCase();
    return { id, width: size.width, height: size.height, byteSize: file.size, sha256 };
  }

  async function importFromPicker(sourceUri: string, candidate: string): Promise<StoredPhoto> {
    const held: { release(): void }[] = [];
    let outputUri: string | null = null;
    let finalFile: File | null = null;
    try {
      const id = requirePhotoId(candidate);
      const fitted = await renderFitted(sourceUri, held).catch((cause: unknown) => {
        throw new PhotoImportError('unreadable', { cause });
      });
      try {
        const saved = await fitted.saveAsync({
          compress: PHOTO_JPEG_COMPRESS,
          format: SaveFormat.JPEG,
        });
        outputUri = saved.uri;
        held.splice(0).forEach(releaseQuietly);
        finalFile = await moveIntoPlace(saved.uri, id);
        return await describeStored(finalFile, id, saved);
      } catch (cause) {
        if (finalFile !== null) {
          deleteFinal(finalFile);
        }
        throw new PhotoImportError('write_failed', { cause });
      }
    } finally {
      deleteCacheFile(sourceUri, logger);
      if (outputUri !== null) {
        deleteCacheFile(outputUri, logger);
      }
      held.forEach(releaseQuietly);
    }
  }

  function listMatching(pattern: RegExp, reportOthers: boolean): PhotoFileInfo[] {
    const directory = photosDirectory();
    if (!directory.exists) {
      return [];
    }
    const found: PhotoFileInfo[] = [];
    for (const entry of directory.list()) {
      if (!(entry instanceof File)) {
        continue;
      }
      const id = parsePhotoId(pattern.exec(entry.name)?.[1] ?? '');
      if (id === null) {
        if (reportOthers && !PARTIAL_FILE_PATTERN.test(entry.name)) {
          logger.warn('photo_invalid_file_name', { name: entry.name });
        }
        continue;
      }
      const modifiedAt = entry.lastModified;
      if (modifiedAt === null) {
        logger.warn('photo_file_unreadable_time', { id });
        continue;
      }
      found.push({ id, modifiedAt: epochMsSchema.parse(Math.floor(modifiedAt)) });
    }
    return found;
  }

  return {
    importFromPicker,
    uriFor: (id) => photoFile(id).uri,
    remove: (id) =>
      attempt(() => {
        deleteIfExists(photoFile(id));
      }),
    listFiles: () => attempt(() => listMatching(PHOTO_FILE_PATTERN, true)),
    listPartialFiles: () => attempt(() => listMatching(PARTIAL_FILE_PATTERN, false)),
    removePartial: (id) =>
      attempt(() => {
        deleteIfExists(partialFile(id));
      }),
  };
}

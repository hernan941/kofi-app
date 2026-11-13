import { PhotoImportError, type PhotoImportErrorCode, type StoredPhoto } from '../domain';
import type { ProductCommandDeps } from './product-command-deps';

/** Resultado de importar una URI. */
export type PhotoImportOutcome =
  | { readonly ok: true; readonly photo: StoredPhoto }
  | { readonly ok: false; readonly code: PhotoImportErrorCode };

async function importOne(
  deps: Pick<ProductCommandDeps, 'ids' | 'photos' | 'logger'>,
  uri: string,
): Promise<PhotoImportOutcome> {
  try {
    return { ok: true, photo: await deps.photos.importFromPicker(uri, deps.ids.next()) };
  } catch (error) {
    if (error instanceof PhotoImportError) {
      return { ok: false, code: error.code };
    }
    deps.logger.error('photo_import_failed', error);
    return { ok: false, code: 'write_failed' };
  }
}

/**
 * Importa en secuencia (una foto a la vez, para acotar memoria en gama baja). Un error
 * inesperado se registra y se informa como `write_failed`. Nunca rechaza.
 */
export async function importPhotos(
  deps: Pick<ProductCommandDeps, 'ids' | 'photos' | 'logger'>,
  uris: readonly string[],
): Promise<readonly PhotoImportOutcome[]> {
  const outcomes: PhotoImportOutcome[] = [];
  for (const uri of uris) {
    outcomes.push(await importOne(deps, uri));
  }
  return outcomes;
}

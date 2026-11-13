import { CLP_INPUT_ERROR_MESSAGES, TEXT_ERROR_MESSAGES, describeWith } from '@/shared/ui';

import type { PhotoImportErrorCode, ProductErrorCode } from '../domain';

/** Spanish text for each code of `PRODUCT_ERROR_CODES`: says how to fix it, never blames. */
export const PRODUCT_ERROR_MESSAGES: Readonly<Record<ProductErrorCode, string>> = {
  required: 'Escribe el nombre del producto',
  too_long: 'Es demasiado largo. Acórtalo un poco',
  version_name_required: 'Ponle un nombre, por ejemplo Print A4',
  duplicate_version_name: 'Ya tienes otra versión con este nombre. Prueba con uno distinto',
  no_active_version: 'Agrega al menos un precio para poder venderlo',
  version_not_found: 'Esta versión ya no está. Vuelve a abrir el producto para ver cómo quedó',
  version_archived:
    'Esta versión ya está en tu historial y no se puede cambiar. Vuelve a abrir el producto',
  version_has_sales: 'Esta versión ya tiene ventas, así que queda guardada en tu historial',
  product_not_found: 'No encontramos este producto. Puede que ya no exista',
  too_many_photos: 'Puedes tener hasta 6 fotos. Quita alguna para agregar otra',
  duplicate_photo: 'Esta foto ya está en el producto',
  photo_not_found: 'Esta foto ya no está. Vuelve a abrir el producto',
};

/**
 * Turns the code of a form error into its message. The product catalog wins over the generic
 * text messages (so `required` of the name says "Escribe el nombre del producto"); amount
 * codes keep their own messages.
 */
export const describeProductError = describeWith({
  ...TEXT_ERROR_MESSAGES,
  ...CLP_INPUT_ERROR_MESSAGES,
  ...PRODUCT_ERROR_MESSAGES,
});

/** Text for each way a single photo can fail to import (design 5.3). */
export const PHOTO_IMPORT_ERROR_MESSAGES: Readonly<Record<PhotoImportErrorCode, string>> = {
  unreadable: 'No pudimos abrir esta imagen. Prueba con otra.',
  write_failed:
    'No pudimos guardar la foto. Revisa que el teléfono tenga espacio e inténtalo de nuevo.',
  invalid_id: 'No pudimos guardar la foto. Inténtalo de nuevo.',
};

/** Message for the photos that failed in one import: the code's own text, or a count for several. */
export function describePhotoImportFailures(codes: readonly PhotoImportErrorCode[]): string | null {
  const [first] = codes;
  if (first === undefined) {
    return null;
  }
  return codes.length === 1
    ? PHOTO_IMPORT_ERROR_MESSAGES[first]
    : `No pudimos agregar ${String(codes.length)} de las fotos. Prueba con otras o inténtalo de nuevo.`;
}

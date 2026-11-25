import type { ComponentRef } from 'react';
import type { View } from 'react-native';

import { MAX_PHOTOS_PER_PRODUCT } from '../domain';

/** Native handle of a `View`, for example to move the accessibility focus to it. */
export type ViewHandle = ComponentRef<typeof View>;

/** Fixed texts of the photos of a product: labels, help, dialogs and announcements. */
export const PHOTO_MESSAGES = {
  sectionTitle: 'Fotos (opcional)',
  helpWithoutPhotos:
    'Una buena foto te ayuda a reconocer el producto al registrar ventas. La primera es la portada.',
  helpWithPhotos: 'La primera es la portada. Toca una foto para moverla o quitarla.',
  coverLabel: 'Portada',
  full: 'Ya tienes 6 fotos, el máximo. Para agregar otra, quita una.',
  coverNow: 'Ahora es la portada.',
  coverNotice: 'Es la portada: se ve en tu lista y al registrar ventas.',
  removeDialogTitle: '¿Quitar esta foto?',
  removeSaved: 'Se quita del producto cuando guardes los cambios.',
  removeNew: 'Se quita de este producto. Si la quieres de nuevo, vuelve a elegirla.',
  removeConfirm: 'Quitar foto',
  cameraDeniedTitle: 'La cámara no tiene permiso',
  cameraDeniedDescription:
    'Para tomar fotos desde Kofi, permite el uso de la cámara en los ajustes del teléfono. Mientras tanto, puedes elegir fotos de la galería.',
  cameraDeniedConfirm: 'Abrir ajustes',
  cameraDeniedCancel: 'Ahora no',
  libraryFailed: 'No se pudo abrir la galería. Inténtalo de nuevo.',
  cameraFailed: 'No se pudo abrir la cámara. Inténtalo de nuevo.',
  missingInForm: 'No pudimos mostrar esta foto. Puedes quitarla y agregarla de nuevo.',
  missingInDetail: 'No pudimos mostrar esta foto.',
  waitingForPhotos: 'Esperando que terminen las fotos',
  savingLabel: 'Preparando fotos…',
  unavailableSuffix: ', no se puede mostrar',
} as const;

function ofMax(count: number): string {
  return `${String(count)} de ${String(MAX_PHOTOS_PER_PRODUCT)}`;
}

/** Counter "3 de 6" next to the section title. */
export function photoCounter(used: number): string {
  return ofMax(used);
}

/** Spoken version of the counter. */
export function photoCounterLabel(used: number): string {
  return `${ofMax(used)} fotos`;
}

/** Announcement after adding photos. */
export function photosAdded(added: number, total: number): string {
  const count = `Tienes ${ofMax(total)}.`;
  return added === 1 ? `Agregaste la foto. ${count}` : `Agregaste ${String(added)} fotos. ${count}`;
}

/** Announcement after removing a photo. */
export function photoRemoved(total: number): string {
  return `Quitaste la foto. Tienes ${ofMax(total)}.`;
}

/** Announcement after moving a photo to a new place (`index` starts at 0). */
export function photoMoved(index: number, total: number): string {
  return `Ahora es la foto ${String(index + 1)} de ${String(total)}.`;
}

/** Group label of the cells that are still being prepared. */
export function photosPreparing(count: number): string {
  return count === 1 ? 'Preparando 1 foto' : `Preparando ${String(count)} fotos`;
}

/** Notice for when the picker trimmed the selection to the room that was left. */
export function selectionTrimmed(kept: number): string {
  return `Agregamos ${String(kept)}: es el espacio que te quedaba.`;
}

/** Accessible label of a thumbnail button, composed from its state (`index` starts at 0). */
export function photoThumbnailLabel(
  index: number,
  total: number,
  state: { readonly isUnavailable: boolean },
): string {
  const position = `Foto ${String(index + 1)} de ${String(total)}`;
  const cover = index === 0 ? ', portada' : '';
  return `${position}${cover}${state.isUnavailable ? PHOTO_MESSAGES.unavailableSuffix : ''}`;
}

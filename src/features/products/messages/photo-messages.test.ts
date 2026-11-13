import { GUILT_PATTERNS, findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import {
  PHOTO_MESSAGES,
  photoCounter,
  photoCounterLabel,
  photoMoved,
  photoRemoved,
  photoThumbnailLabel,
  photosAdded,
  photosPreparing,
  selectionTrimmed,
} from './photo-messages';

const GENERATED = [
  photoCounter(3),
  photoCounterLabel(3),
  photosAdded(1, 1),
  photosAdded(2, 3),
  photoRemoved(2),
  photoMoved(2, 3),
  photosPreparing(1),
  photosPreparing(2),
  selectionTrimmed(2),
  photoThumbnailLabel(0, 3, { isUnavailable: true }),
];

describe('photo messages', () => {
  it('has guilt patterns to check against', () => {
    expect(GUILT_PATTERNS.length).toBeGreaterThan(0);
  });

  it.each([...Object.entries(PHOTO_MESSAGES), ...GENERATED.map((text) => [text, text])])(
    'never blames: %s',
    (_name, text) => {
      expect(findGuiltPattern(text)).toBeNull();
    },
  );

  it('writes the announcements the person hears', () => {
    expect(photosAdded(1, 1)).toBe('Agregaste la foto. Tienes 1 de 6.');
    expect(photosAdded(2, 3)).toBe('Agregaste 2 fotos. Tienes 3 de 6.');
    expect(photoRemoved(2)).toBe('Quitaste la foto. Tienes 2 de 6.');
    expect(photoMoved(2, 3)).toBe('Ahora es la foto 3 de 3.');
    expect(PHOTO_MESSAGES.coverNow).toBe('Ahora es la portada.');
    expect(selectionTrimmed(2)).toBe('Agregamos 2: es el espacio que te quedaba.');
  });

  it('labels the cells that are being prepared', () => {
    expect(photosPreparing(1)).toBe('Preparando 1 foto');
    expect(photosPreparing(3)).toBe('Preparando 3 fotos');
  });

  it('composes the thumbnail label from position, cover and state', () => {
    expect(photoThumbnailLabel(0, 3, { isUnavailable: false })).toBe('Foto 1 de 3, portada');
    expect(photoThumbnailLabel(1, 3, { isUnavailable: false })).toBe('Foto 2 de 3');
    expect(photoThumbnailLabel(1, 3, { isUnavailable: true })).toBe(
      'Foto 2 de 3, no se puede mostrar',
    );
    expect(photoThumbnailLabel(0, 1, { isUnavailable: true })).toBe(
      'Foto 1 de 1, portada, no se puede mostrar',
    );
  });
});

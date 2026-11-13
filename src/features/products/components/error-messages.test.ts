import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { PRODUCT_ERROR_CODES } from '../domain';
import {
  PHOTO_IMPORT_ERROR_MESSAGES,
  PRODUCT_ERROR_MESSAGES,
  describeProductError,
  describePhotoImportFailures,
} from './error-messages';

describe('PRODUCT_ERROR_MESSAGES', () => {
  it.each(PRODUCT_ERROR_CODES)('has a Spanish message without blame for %s', (code) => {
    const message = PRODUCT_ERROR_MESSAGES[code];

    expect(message.length).toBeGreaterThan(0);
    expect(findGuiltPattern(message)).toBeNull();
  });
});

describe('PHOTO_IMPORT_ERROR_MESSAGES', () => {
  it.each(Object.keys(PHOTO_IMPORT_ERROR_MESSAGES) as (keyof typeof PHOTO_IMPORT_ERROR_MESSAGES)[])(
    'has a message without blame for %s',
    (code) => {
      const message = PHOTO_IMPORT_ERROR_MESSAGES[code];

      expect(message.length).toBeGreaterThan(0);
      expect(findGuiltPattern(message)).toBeNull();
    },
  );

  it('covers every import error code', () => {
    expect(Object.keys(PHOTO_IMPORT_ERROR_MESSAGES).sort()).toEqual([
      'invalid_id',
      'unreadable',
      'write_failed',
    ]);
  });
});

describe('describePhotoImportFailures', () => {
  it('uses the message of the code for one failure', () => {
    expect(describePhotoImportFailures(['unreadable'])).toBe(
      'No pudimos abrir esta imagen. Prueba con otra.',
    );
  });

  it('counts the failures when there are several', () => {
    expect(describePhotoImportFailures(['unreadable', 'write_failed'])).toBe(
      'No pudimos agregar 2 de las fotos. Prueba con otras o inténtalo de nuevo.',
    );
  });

  it('is empty without failures', () => {
    expect(describePhotoImportFailures([])).toBeNull();
  });
});

describe('describeProductError', () => {
  it('gives the product catalog priority over the generic text messages', () => {
    expect(describeProductError({ type: 'custom', message: 'required' })).toBe(
      'Escribe el nombre del producto',
    );
  });

  it('translates amount codes', () => {
    expect(describeProductError({ type: 'custom', message: 'empty' })).toBe(
      'Escribe un monto, por ejemplo 15.000',
    );
  });

  it('falls back for an unknown code', () => {
    expect(describeProductError({ type: 'custom', message: 'nope' })).toBe('Revisa este campo');
  });
});

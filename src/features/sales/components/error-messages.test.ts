import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { SALE_ERROR_CODES } from '../domain';
import { SALE_ERROR_MESSAGES, describeSaleError } from './error-messages';

const BLAME_WORDS = ['error', 'inválid', 'incorrect', 'debes', 'falló', 'mal'];

/** Lowercase text without accents, to compare against the forbidden words. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('á', 'a')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ú', 'u');
}

describe('SALE_ERROR_MESSAGES', () => {
  it.each(SALE_ERROR_CODES)('has a Spanish message without blame for %s', (code) => {
    const message = SALE_ERROR_MESSAGES[code];

    expect(message.length).toBeGreaterThan(0);
    for (const word of BLAME_WORDS) {
      expect(plain(message)).not.toContain(plain(word));
    }
    expect(findGuiltPattern(message)).toBeNull();
  });

  it('has exactly one message per code', () => {
    expect(Object.keys(SALE_ERROR_MESSAGES).sort()).toEqual([...SALE_ERROR_CODES].sort());
  });

  it('tells how to fix the common ones', () => {
    expect(SALE_ERROR_MESSAGES.no_items).toBe('Elige al menos un producto que vendiste');
    expect(SALE_ERROR_MESSAGES.price_required).toBe(
      'Escribe a cuánto lo vendiste, por ejemplo 15.000',
    );
    expect(SALE_ERROR_MESSAGES.quantity_out_of_range).toBe('Escribe una cantidad entre 1 y 9.999');
    expect(SALE_ERROR_MESSAGES.future_date).toBe('Elige hoy o un día anterior');
  });
});

describe('describeSaleError', () => {
  it('translates the codes of the sales catalog', () => {
    expect(describeSaleError({ type: 'custom', message: 'price_required' })).toBe(
      'Escribe a cuánto lo vendiste, por ejemplo 15.000',
    );
  });

  it('gives the sales catalog priority over the generic text messages', () => {
    expect(describeSaleError({ type: 'custom', message: 'required' })).toBe(
      SALE_ERROR_MESSAGES.required,
    );
  });

  it('translates amount codes for an empty fixed price', () => {
    expect(describeSaleError({ type: 'custom', message: 'empty' })).toBe(
      'Escribe un monto, por ejemplo 15.000',
    );
    expect(describeSaleError({ type: 'custom', message: 'comma_not_allowed' })).toBe(
      'Escribe el monto sin comas',
    );
  });

  it('falls back for an unknown code', () => {
    expect(describeSaleError({ type: 'custom', message: 'nope' })).toBe('Revisa este campo');
  });
});

import {
  clpSchema,
  formatClp,
  formatClpAccessible,
  formatClpDigits,
  parseClpInput,
  signedClpSchema,
  type Clp,
  type SignedClp,
} from './money';

const clp = (value: number): Clp => clpSchema.parse(value);
const signed = (value: number): SignedClp => signedClpSchema.parse(value);

describe('clpSchema', () => {
  test.each([0, 1, 15_000, 999_999_999])('accepts %p', (value) => {
    expect(clpSchema.safeParse(value).success).toBe(true);
  });

  test.each([-1, 1.5, 1_000_000_000, Number.NaN, '100'])('rejects %p', (value) => {
    expect(clpSchema.safeParse(value).success).toBe(false);
  });
});

describe('signedClpSchema', () => {
  test.each([-999_999_999, -5000, 0, 999_999_999])('accepts %p', (value) => {
    expect(signedClpSchema.safeParse(value).success).toBe(true);
  });

  test.each([-1_000_000_000, 1_000_000_000, 0.5])('rejects %p', (value) => {
    expect(signedClpSchema.safeParse(value).success).toBe(false);
  });
});

describe('formatClp', () => {
  test.each([
    [0, '$0'],
    [1, '$1'],
    [999, '$999'],
    [1000, '$1.000'],
    [15_000, '$15.000'],
    [1_000_000, '$1.000.000'],
    [999_999_999, '$999.999.999'],
  ])('formats %p as %s', (value, expected) => {
    expect(formatClp(clp(value))).toBe(expected);
  });

  test.each([
    [-5000, '-$5.000'],
    [-1, '-$1'],
    [-999_999_999, '-$999.999.999'],
    [7000, '$7.000'],
  ])('formats the signed amount %p as %s', (value, expected) => {
    expect(formatClp(signed(value))).toBe(expected);
  });

  test('throws for values outside the type', () => {
    expect(() => formatClp(1.5 as Clp)).toThrow(RangeError);
    expect(() => formatClp(1_000_000_000 as Clp)).toThrow(RangeError);
  });
});

describe('formatClpDigits', () => {
  it.each([
    [0, '0'],
    [15000, '15.000'],
    [999_999_999, '999.999.999'],
  ])('formats %i as %s without the currency sign', (value, expected) => {
    expect(formatClpDigits(clp(value))).toBe(expected);
  });

  it('rejects values outside the range of the type', () => {
    expect(() => formatClpDigits(1.5 as Clp)).toThrow(RangeError);
  });
});

describe('formatClpAccessible', () => {
  test.each([
    [0, '0 pesos'],
    [1, '1 peso'],
    [15_000, '15.000 pesos'],
    [1_500_000, '1.500.000 pesos'],
  ])('reads %p as "%s"', (value, expected) => {
    expect(formatClpAccessible(clp(value))).toBe(expected);
  });

  test('announces negative amounts', () => {
    expect(formatClpAccessible(signed(-5000))).toBe('menos 5.000 pesos');
  });
});

describe('parseClpInput', () => {
  test.each([
    ['15000', 15_000],
    ['15.000', 15_000],
    ['1.500.000', 1_500_000],
    ['$15.000', 15_000],
    ['  15.000  ', 15_000],
    ['$ 15 000', 15_000],
    ['0', 0],
    ['999999999', 999_999_999],
  ])('accepts "%s"', (text, expected) => {
    expect(parseClpInput(text)).toEqual({ ok: true, value: expected });
  });

  test.each([
    ['1.5', 'invalid_grouping'],
    ['1.50.0', 'invalid_grouping'],
    ['.500', 'invalid_grouping'],
    ['1000.000', 'invalid_grouping'],
    ['15,000', 'comma_not_allowed'],
    ['15,5', 'comma_not_allowed'],
    ['-500', 'negative_not_allowed'],
    ['$-500', 'negative_not_allowed'],
    ['1000000000', 'too_large'],
    ['1.000.000.000', 'too_large'],
    ['', 'empty'],
    ['   ', 'empty'],
    ['$', 'empty'],
    ['abc', 'invalid_format'],
    ['15a', 'invalid_format'],
    ['1e3', 'invalid_format'],
    ['$$15', 'invalid_format'],
  ])('rejects "%s" with %s', (text, code) => {
    expect(parseClpInput(text)).toEqual({ ok: false, error: code });
  });
});

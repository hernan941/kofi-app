import { escapeCsvCell, serializeCsv } from './csv-writer';

describe('escapeCsvCell', () => {
  test('leaves plain text untouched', () => {
    expect(escapeCsvCell('Lámina ñandú')).toBe('Lámina ñandú');
  });

  test.each([
    ['a;b', '"a;b"'],
    ['dijo "hola"', '"dijo ""hola"""'],
    ['uno\ndos', '"uno\ndos"'],
    ['uno\r\ndos', '"uno\r\ndos"'],
    ['uno\rdos', '"uno\rdos"'],
  ])('quotes %j when it has separators, quotes or line breaks', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  test.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'prefixes %j with an apostrophe against formula injection',
    (input) => {
      const escaped = escapeCsvCell(input);
      expect(escaped.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  test('prefixes before quoting', () => {
    expect(escapeCsvCell('=1;2')).toBe(`"'=1;2"`);
    expect(escapeCsvCell('\rx')).toBe(`"'\rx"`);
  });

  test('does not prefix a formula character that is not first', () => {
    expect(escapeCsvCell('a=1')).toBe('a=1');
  });

  test('keeps an empty cell empty', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('serializeCsv', () => {
  test('starts with a BOM, joins with ; and ends every row with CRLF', () => {
    expect(
      serializeCsv([
        ['a', 'b'],
        ['1', 'x;y'],
      ]),
    ).toBe('﻿a;b\r\n1;"x;y"\r\n');
  });

  test('an empty table is just the BOM', () => {
    expect(serializeCsv([])).toBe('﻿');
  });
});

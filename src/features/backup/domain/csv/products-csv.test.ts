import { clpSchema } from '@/shared/domain';

import {
  EMPTY_SNAPSHOT,
  productRow,
  richSnapshot,
  versionRow,
  at,
} from '../../testing/snapshot-fixtures';
import { buildProductsCsv } from './products-csv';

function lines(csv: string): string[] {
  return csv.replace('﻿', '').split('\r\n').slice(0, -1);
}

describe('buildProductsCsv', () => {
  test('has the exact Spanish headers', () => {
    expect(buildProductsCsv(EMPTY_SNAPSHOT)).toBe('﻿Producto;Versión;Precio;Costo;Archivado\r\n');
  });

  test('writes one row per non-deleted version of non-deleted products', () => {
    expect(lines(buildProductsCsv(richSnapshot())).slice(1)).toEqual([
      'Lámina ñandú;A4;1000;300;No',
      'Lámina ñandú;A3;a convenir;;No',
      'Lámina ñandú;Vieja;1000;;Sí',
      'Taza;;1000;;Sí',
    ]);
  });

  test('marks a version archived when only the version is archived', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [productRow(1, { name: 'P' })],
      productVersions: [versionRow(1, 1, { archivedAt: at(5) }), versionRow(2, 1, { position: 1 })],
    };
    expect(lines(buildProductsCsv(snapshot)).slice(1)).toEqual(['P;;1000;;Sí', 'P;;1000;;No']);
  });

  test('orders products as in the list (D-31): ñ after n, accents ignored', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [
        productRow(1, { name: 'Ñandú' }),
        productRow(2, { name: 'nube' }),
        productRow(3, { name: 'Árbol' }),
      ],
      productVersions: [versionRow(1, 1), versionRow(2, 2), versionRow(3, 3)],
    };
    const names = lines(buildProductsCsv(snapshot))
      .slice(1)
      .map((line) => line.split(';')[0]);
    expect(names).toEqual(['Árbol', 'nube', 'Ñandú']);
  });

  test('orders versions by position and id, and writes a zero price as 0', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [productRow(1, { name: 'P' })],
      productVersions: [
        versionRow(2, 1, { name: 'b', position: 1 }),
        versionRow(1, 1, { name: 'a', position: 1, price: clpSchema.parse(0) }),
        versionRow(3, 1, { name: 'c', position: 0 }),
      ],
    };
    expect(lines(buildProductsCsv(snapshot)).slice(1)).toEqual([
      'P;c;1000;;No',
      'P;a;0;;No',
      'P;b;1000;;No',
    ]);
  });

  test('neutralizes formulas in the product name', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [productRow(1, { name: '=1+1' })],
      productVersions: [versionRow(1, 1)],
    };
    expect(lines(buildProductsCsv(snapshot))[1]).toBe("'=1+1;;1000;;No");
  });
});

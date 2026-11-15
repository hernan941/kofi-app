import { clpSchema, localDateSchema } from '@/shared/domain';

import {
  EMPTY_SNAPSHOT,
  at,
  itemRow,
  productRow,
  recordRow,
  richSnapshot,
  versionRow,
} from '../../testing/snapshot-fixtures';
import { buildSalesCsv } from './sales-csv';

const LABELS = {
  fair: 'En una feria',
  social_media: 'Por redes sociales',
  store_or_consignment: 'En una tienda',
  custom_order: 'Por encargo',
  other: 'Otro',
} as const;

function lines(csv: string): string[] {
  return csv.replace('﻿', '').split('\r\n').slice(0, -1);
}

describe('buildSalesCsv', () => {
  test('has the exact Spanish headers, BOM, and CRLF after the last row', () => {
    const csv = buildSalesCsv(EMPTY_SNAPSHOT, LABELS);
    expect(csv).toBe(
      '﻿Fecha;Registro;Producto;Versión;Cantidad;Precio unitario;Subtotal;Dónde vendiste;Nota\r\n',
    );
  });

  test('writes one row per active item of an active record, with subtotal and channel label', () => {
    const rows = lines(buildSalesCsv(richSnapshot(), LABELS)).slice(1);
    expect(rows).toHaveLength(3);
    expect(rows).toContain(
      '2026-03-02;00000004-0000-7000-8000-000000000001;Lámina ñandú;A4;2;1000;2000;En una feria;"Feria; ""grande"""',
    );
  });

  test('keeps the current name of an archived product and leaves empty cells empty', () => {
    const rows = lines(buildSalesCsv(richSnapshot(), LABELS));
    expect(rows.some((row) => row.includes(';Taza;;3;1000;3000;'))).toBe(true);
    expect(rows).toContain(
      '2026-03-01;00000004-0000-7000-8000-000000000002;Lámina ñandú;A3;2;5000;10000;;',
    );
  });

  test('excludes deleted records and deleted items', () => {
    const csv = buildSalesCsv(richSnapshot(), LABELS);
    expect(csv).not.toContain('00000004-0000-7000-8000-000000000003');
    expect(lines(csv)).toHaveLength(4);
  });

  test('orders by record date, creation and id, then by item position', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [productRow(1, { name: 'P' })],
      productVersions: [versionRow(1, 1)],
      saleRecords: [
        recordRow(1, { soldOn: localDateSchema.parse('2026-03-05'), createdAt: at(1) }),
        recordRow(2, { soldOn: localDateSchema.parse('2026-03-01'), createdAt: at(9) }),
        recordRow(3, { soldOn: localDateSchema.parse('2026-03-01'), createdAt: at(2) }),
      ],
      saleItems: [
        itemRow(1, 1, 1, 1),
        itemRow(2, 2, 1, 1, { position: 1, unitPrice: clpSchema.parse(20) }),
        itemRow(3, 2, 1, 1, { position: 0, unitPrice: clpSchema.parse(10) }),
        itemRow(4, 3, 1, 1),
      ],
    };
    const records = lines(buildSalesCsv(snapshot, LABELS))
      .slice(1)
      .map((line) => line.split(';').slice(0, 2).join(' '));
    expect(records).toEqual([
      '2026-03-01 00000004-0000-7000-8000-000000000003',
      '2026-03-01 00000004-0000-7000-8000-000000000002',
      '2026-03-01 00000004-0000-7000-8000-000000000002',
      '2026-03-05 00000004-0000-7000-8000-000000000001',
    ]);
    const prices = lines(buildSalesCsv(snapshot, LABELS))
      .slice(1)
      .map((line) => line.split(';')[5]);
    expect(prices.slice(1, 3)).toEqual(['10', '20']);
  });

  test('neutralizes formulas in product, version and note', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      products: [productRow(1, { name: '=HYPERLINK("x")' })],
      productVersions: [versionRow(1, 1, { name: '+cmd' })],
      saleRecords: [recordRow(1, { note: '@nota' })],
      saleItems: [itemRow(1, 1, 1, 1)],
    };
    const row = lines(buildSalesCsv(snapshot, LABELS))[1] ?? '';
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain(";'+cmd;");
    expect(row.endsWith(";'@nota")).toBe(true);
  });
});

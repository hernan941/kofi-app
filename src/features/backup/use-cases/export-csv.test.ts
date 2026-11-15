import type { SaleChannel } from '@/features/sales/domain';

import { buildProductsCsv, buildSalesCsv, encodeUtf8 } from '../domain';
import { FREE_SPACE_MARGIN_BYTES } from '../domain/space';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { FakeFileSharer } from '../testing/fake-file-sharer';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { richSnapshot } from '../testing/snapshot-fixtures';
import { exportProductsCsv, exportSalesCsv, type CsvExportDeps } from './export-csv';

const LABELS: Readonly<Record<SaleChannel, string>> = {
  fair: 'En una feria',
  social_media: 'Por redes sociales',
  store_or_consignment: 'En una tienda',
  custom_order: 'Por encargo',
  other: 'Otro',
};

function setUp(snapshot: DatabaseSnapshot = richSnapshot()) {
  const io = new InMemoryArchiveIo();
  const sharer = new FakeFileSharer();
  const backupFiles = new FakeBackupFiles();
  const reads: number[] = [];
  const deps: CsvExportDeps = {
    store: {
      readSnapshot: () => {
        reads.push(1);
        return Promise.resolve(snapshot);
      },
    },
    archiveIo: io,
    backupFiles,
    fileSharer: sharer,
  };
  return { deps, io, sharer, reads, snapshot };
}

describe('exportSalesCsv', () => {
  it('writes ventas.csv with the BOM and shares it as text/csv', async () => {
    const { deps, io, sharer, snapshot } = setUp();

    const result = await exportSalesCsv(deps, LABELS);

    const uri = 'file:///fake/cache/backups/ventas.csv';
    expect(result).toEqual({ ok: true, value: undefined });
    expect(io.files.get(uri)).toEqual(encodeUtf8(buildSalesCsv(snapshot, LABELS)));
    expect(io.files.get(uri)?.slice(0, 3)).toEqual(Uint8Array.of(0xef, 0xbb, 0xbf));
    expect(sharer.shared).toEqual([
      { fileUri: uri, mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
    ]);
    expect(io.allClosed()).toBe(true);
  });

  it('uses the channel labels it receives', async () => {
    const { deps, io } = setUp();

    await exportSalesCsv(deps, LABELS);

    const text = new TextDecoder().decode(io.files.get('file:///fake/cache/backups/ventas.csv'));
    expect(text).toContain('En una feria');
  });

  it('reports sharing_unavailable without reading or writing', async () => {
    const { deps, io, sharer, reads } = setUp();
    sharer.available = false;

    const result = await exportSalesCsv(deps, LABELS);

    expect(result).toEqual({ ok: false, error: { code: 'sharing_unavailable' } });
    expect(io.created).toEqual([]);
    expect(reads).toEqual([]);
  });

  it('fails with not_enough_space using the size of the text plus the margin', async () => {
    const { deps, io, sharer, snapshot } = setUp();
    const size = encodeUtf8(buildSalesCsv(snapshot, LABELS)).length;
    io.freeSpace = size + FREE_SPACE_MARGIN_BYTES - 1;

    const result = await exportSalesCsv(deps, LABELS);

    expect(result).toEqual({
      ok: false,
      error: { code: 'not_enough_space', requiredBytes: size + FREE_SPACE_MARGIN_BYTES },
    });
    expect(io.created).toEqual([]);
    expect(sharer.shared).toEqual([]);
  });

  it('closes the writer when the write fails', async () => {
    const { deps, io } = setUp();
    io.failWriteAtCall = 1;

    await expect(exportSalesCsv(deps, LABELS)).rejects.toThrow('write failed');
    expect(io.allClosed()).toBe(true);
  });
});

describe('exportProductsCsv', () => {
  it('writes productos.csv and shares it as text/csv', async () => {
    const { deps, io, sharer, snapshot } = setUp();

    const result = await exportProductsCsv(deps);

    const uri = 'file:///fake/cache/backups/productos.csv';
    expect(result).toEqual({ ok: true, value: undefined });
    expect(io.files.get(uri)).toEqual(encodeUtf8(buildProductsCsv(snapshot)));
    expect(sharer.shared).toEqual([
      { fileUri: uri, mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
    ]);
  });

  it('exports an empty database with only the headers', async () => {
    const { deps, io } = setUp({
      products: [],
      productVersions: [],
      productPhotos: [],
      saleRecords: [],
      saleItems: [],
      noSalesWeeks: [],
      tipViews: [],
    });

    await exportProductsCsv(deps);

    const text = new TextDecoder().decode(io.files.get('file:///fake/cache/backups/productos.csv'));
    expect(text.split('\r\n').filter((line) => line !== '')).toHaveLength(1);
  });
});

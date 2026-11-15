import type { SaleChannel } from '@/features/sales/domain';
import { err, ok, type Result } from '@/shared/domain';

import type { BackupStore } from '../data/backup-store';
import { buildProductsCsv } from '../domain/csv/products-csv';
import { buildSalesCsv } from '../domain/csv/sales-csv';
import type { ExportError } from '../domain/errors';
import { PRODUCTS_CSV_FILE_NAME, SALES_CSV_FILE_NAME } from '../domain/file-names';
import type { ArchiveIo, BackupFiles, FileSharer } from '../domain/ports';
import { FREE_SPACE_MARGIN_BYTES } from '../domain/space';
import { encodeUtf8 } from '../domain/utf8';

/** Dependencias de los casos de uso de CSV. */
export interface CsvExportDeps {
  readonly store: Pick<BackupStore, 'readSnapshot'>;
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: Pick<BackupFiles, 'exportTarget'>;
  readonly fileSharer: FileSharer;
}

async function writeAndShare(
  deps: CsvExportDeps,
  fileName: string,
  buildText: (snapshot: Awaited<ReturnType<BackupStore['readSnapshot']>>) => string,
): Promise<Result<void, ExportError>> {
  if (!(await deps.fileSharer.isAvailable())) {
    return err({ code: 'sharing_unavailable' });
  }
  const bytes = encodeUtf8(buildText(await deps.store.readSnapshot()));
  const requiredBytes = bytes.length + FREE_SPACE_MARGIN_BYTES;
  if (deps.archiveIo.availableDiskSpace() < requiredBytes) {
    return err({ code: 'not_enough_space', requiredBytes });
  }
  const uri = deps.backupFiles.exportTarget(fileName);
  const writer = await deps.archiveIo.createForWrite(uri);
  try {
    await writer.write(bytes);
  } finally {
    writer.close();
  }
  await deps.fileSharer.share(uri, {
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
  });
  return ok(undefined);
}

/**
 * Exporta `ventas.csv` (D-10, D-44) y lo comparte. No toma el lock de archivos porque no lee
 * fotos; el margen de espacio libre es el tamaño del texto más `FREE_SPACE_MARGIN_BYTES`.
 */
export function exportSalesCsv(
  deps: CsvExportDeps,
  channelLabels: Readonly<Record<SaleChannel, string>>,
): Promise<Result<void, ExportError>> {
  return writeAndShare(deps, SALES_CSV_FILE_NAME, (snapshot) =>
    buildSalesCsv(snapshot, channelLabels),
  );
}

/** Exporta `productos.csv` (D-10) y lo comparte, con las mismas reglas que `exportSalesCsv`. */
export function exportProductsCsv(deps: CsvExportDeps): Promise<Result<void, ExportError>> {
  return writeAndShare(deps, PRODUCTS_CSV_FILE_NAME, buildProductsCsv);
}

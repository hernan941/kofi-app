import type { EpochMs, ProductPhotoId } from '@/shared/domain';

import type { DatabaseSnapshot, SnapshotProductPhotoRow } from '../snapshot';

/** Lo que el disco dice de un archivo de foto: tamaño real y `sha256` calculado. */
export interface DiskPhoto {
  readonly byteSize: number;
  readonly sha256: string;
}

/** Cuántas fotos activas no coincidían con el disco; solo conteos, sin datos del negocio. */
export interface ExportWarnings {
  readonly hashMismatches: number;
  readonly missingFiles: number;
}

/** Instantánea ajustada al disco y sus advertencias. */
export interface PreparedExport {
  readonly snapshot: DatabaseSnapshot;
  readonly warnings: ExportWarnings;
}

/**
 * Ajusta las fotos activas a lo que hay en disco (backup.md, 4.1): si el `sha256` o el tamaño de
 * la fila difieren, gana el disco; si el archivo falta (o está vacío), la fila sale borrada
 * lógicamente en `now`, solo en el respaldo. Las fotos ya borradas y las demás tablas no cambian.
 */
export function prepareExportSnapshot(
  snapshot: DatabaseSnapshot,
  diskPhotos: ReadonlyMap<ProductPhotoId, DiskPhoto>,
  now: EpochMs,
): PreparedExport {
  let hashMismatches = 0;
  let missingFiles = 0;

  function adjust(row: SnapshotProductPhotoRow): SnapshotProductPhotoRow {
    if (row.deletedAt !== null) {
      return row;
    }
    const onDisk = diskPhotos.get(row.id);
    if (onDisk === undefined || onDisk.byteSize <= 0) {
      missingFiles += 1;
      return { ...row, deletedAt: now, updatedAt: now };
    }
    if (onDisk.sha256 === row.sha256 && onDisk.byteSize === row.byteSize) {
      return row;
    }
    hashMismatches += 1;
    return { ...row, sha256: onDisk.sha256, byteSize: onDisk.byteSize };
  }

  const productPhotos = snapshot.productPhotos.map(adjust);
  return {
    snapshot: { ...snapshot, productPhotos },
    warnings: { hashMismatches, missingFiles },
  };
}

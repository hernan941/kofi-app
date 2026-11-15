import { CENTRAL_HEADER_SIZE, EOCD_SIZE, LOCAL_HEADER_SIZE } from './zip/format';

/** Margen fijo para no dejar el teléfono sin espacio: 64 MiB. */
export const FREE_SPACE_MARGIN_BYTES = 67_108_864;

/** Σ(30 + nombre + tamaño) + Σ(46 + nombre) + 22; los nombres son ASCII. */
export function estimateArchiveBytes(
  entries: readonly { readonly path: string; readonly size: number }[],
): number {
  return entries.reduce(
    (total, { path, size }) =>
      total + LOCAL_HEADER_SIZE + path.length + size + CENTRAL_HEADER_SIZE + path.length,
    EOCD_SIZE,
  );
}

/** Exportación: el ZIP completo más el margen. */
export function requiredBytesForExport(archiveBytes: number): number {
  return archiveBytes + FREE_SPACE_MARGIN_BYTES;
}

/** Restauración: respaldo de seguridad + fotos que hay que copiar (las que no existen ya) + margen. */
export function requiredBytesForRestore(input: {
  readonly safetyArchiveBytes: number;
  readonly photosToCopyBytes: number;
}): number {
  return input.safetyArchiveBytes + input.photosToCopyBytes + FREE_SPACE_MARGIN_BYTES;
}

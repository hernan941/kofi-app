const BYTES_PER_MB = 1_000_000;
const BYTES_PER_GB_TENTH = 100_000_000;
const MB_PER_GB = 1000;
const TENTHS_PER_GB = 10;

/**
 * Tamaño legible con unidades decimales, como las muestra el teléfono, redondeando hacia arriba
 * (F8.1, 5.6): menos de 1.000 MB en MB enteros ("350 MB"), desde 1.000 MB en GB con un decimal
 * y coma ("1,2 GB"). Nunca menos de "1 MB".
 */
export function formatStorageSize(bytes: number): string {
  const megabytes = Math.max(1, Math.ceil(bytes / BYTES_PER_MB));
  if (megabytes < MB_PER_GB) {
    return `${String(megabytes)} MB`;
  }
  const tenths = Math.ceil(bytes / BYTES_PER_GB_TENTH);
  return `${String(Math.floor(tenths / TENTHS_PER_GB))},${String(tenths % TENTHS_PER_GB)} GB`;
}

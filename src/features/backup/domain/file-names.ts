import { epochMsSchema, localDateSchema, type EpochMs, type LocalDate } from '@/shared/domain';

/** Nombre fijo del CSV de ventas. */
export const SALES_CSV_FILE_NAME = 'ventas.csv';
/** Nombre fijo del CSV de productos. */
export const PRODUCTS_CSV_FILE_NAME = 'productos.csv';

const BACKUP_PATTERN = /^cuantovendi-respaldo-(\d{4}-\d{2}-\d{2})\.zip$/;
const SAFETY_PATTERN = /^cuantovendi-seguridad-(\d{13})\.zip$/;
const SAFETY_DIGITS = 13;

/** `cuantovendi-respaldo-AAAA-MM-DD.zip`, con la fecha local de quien exporta. */
export function backupFileName(date: LocalDate): string {
  return `cuantovendi-respaldo-${date}.zip`;
}

/** `cuantovendi-emergencia-AAAA-MM-DD.zip`, con la fecha local de quien exporta. */
export function emergencyFileName(date: LocalDate): string {
  return `cuantovendi-emergencia-${date}.zip`;
}

/** `cuantovendi-seguridad-<epochMs de 13 dígitos>.zip`. */
export function safetyFileName(createdAt: EpochMs): string {
  return `cuantovendi-seguridad-${String(createdAt).padStart(SAFETY_DIGITS, '0')}.zip`;
}

/** Instante de un nombre de respaldo de seguridad, o `null` si el nombre no sigue el patrón. */
export function parseSafetyFileName(name: string): EpochMs | null {
  const match = SAFETY_PATTERN.exec(name);
  const parsed = epochMsSchema.safeParse(Number(match?.[1]));
  return match !== null && parsed.success ? parsed.data : null;
}

/** Indica si el nombre es uno de los que genera la exportación (respaldo con fecha válida o CSV). */
export function isExportFileName(name: string): boolean {
  if (name === SALES_CSV_FILE_NAME || name === PRODUCTS_CSV_FILE_NAME) {
    return true;
  }
  const date = BACKUP_PATTERN.exec(name)?.[1];
  return date !== undefined && localDateSchema.safeParse(date).success;
}

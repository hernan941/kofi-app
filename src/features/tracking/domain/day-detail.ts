import { clpSchema, type Clp, type LocalDate } from '@/shared/domain';
import { MAX_SALE_TOTAL, hasItems, recordTotal, type SaleRecord } from '@/features/sales/domain';

/** Resumen de un día para su pantalla. */
export interface DayDetail {
  readonly date: LocalDate;
  readonly total: Clp;
  readonly recordCount: number;
  /** D-03: `false` si `date` es posterior a `today`. */
  readonly canRegister: boolean;
}

/** Total y cantidad de registros con ítems del día; se puede registrar hoy y en el pasado (D-03). */
export function buildDayDetail(
  date: LocalDate,
  today: LocalDate,
  records: readonly SaleRecord[],
): DayDetail {
  const ofDay = records.filter((record) => record.soldOn === date && hasItems(record));
  const total = ofDay.reduce((sum, record) => sum + recordTotal(record), 0);
  return {
    date,
    total: clpSchema.parse(Math.min(total, MAX_SALE_TOTAL)),
    recordCount: ofDay.length,
    canRegister: date <= today,
  };
}

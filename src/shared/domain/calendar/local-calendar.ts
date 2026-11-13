import type { EpochMs } from '../epoch-ms';

import type { LocalDate } from './local-date';

/**
 * Frontera entre instantes y fechas locales en la zona horaria del dispositivo.
 * Es la única pieza que interpreta zonas; el resto del dominio usa `LocalDate` (ADR-015).
 */
export interface LocalCalendar {
  /** Fecha local del dispositivo en la que cae el instante. */
  localDateOf(instant: EpochMs): LocalDate;
  /**
   * Instante correspondiente a una hora local de pared (`minuteOfDay` de 0 a 1439).
   * Si el minuto no existe por un cambio de hora, devuelve el primer minuto válido posterior;
   * si existe dos veces, devuelve la primera ocurrencia.
   */
  instantAt(date: LocalDate, minuteOfDay: number): EpochMs;
  /** Instante de la próxima medianoche local después de `instant`, para refrescar "hoy". */
  nextLocalMidnight(instant: EpochMs): EpochMs;
}

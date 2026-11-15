import type { Logger } from '@/shared/lib/logger';
import type { EpochMs } from '@/shared/domain';

import { tipIdSchema, type TipView } from '../domain';

/** Fila guardada de un consejo visto, tal como la lee el repositorio (sin validar el id). */
export interface StoredTipViewRow {
  readonly tipId: string;
  readonly firstSeenAt: EpochMs;
  readonly lastSeenAt: EpochMs;
}

/**
 * Convierte las filas guardadas en `TipView`. Una fila con un id inválido (un slug que ya no
 * es válido o que se corrompió) se descarta y se deja en el logger: un dato malo no debe
 * impedir ver los demás consejos.
 */
export function parseTipViewRows(
  rows: readonly StoredTipViewRow[],
  logger: Logger,
): readonly TipView[] {
  const views: TipView[] = [];
  for (const row of rows) {
    const tipId = tipIdSchema.safeParse(row.tipId);
    if (tipId.success) {
      views.push({ tipId: tipId.data, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt });
    } else {
      logger.warn('tip_view_row_discarded', { tipId: row.tipId });
    }
  }
  return views;
}

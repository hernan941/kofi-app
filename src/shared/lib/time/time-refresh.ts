import type { EpochMs } from '@/shared/domain/epoch-ms';
import { epochMsSchema } from '@/shared/domain/epoch-ms';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';

const MAX_REFRESH_INTERVAL_MS = 3_600_000;

/**
 * Próximo instante en el que "hoy" debe recalcularse: la próxima medianoche local o, como
 * máximo, una hora después de `now` (ADR-009, ADR-015).
 */
export function nextTodayRefreshAt(now: EpochMs, calendar: LocalCalendar): EpochMs {
  const limit = now + MAX_REFRESH_INTERVAL_MS;
  return epochMsSchema.parse(Math.min(calendar.nextLocalMidnight(now), limit));
}

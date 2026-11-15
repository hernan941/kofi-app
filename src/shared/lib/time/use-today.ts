import { use } from 'react';

import type { LocalDate } from '@/shared/domain/calendar/local-date';

import { TodayContext } from './today-provider';

/**
 * Fecha local actual (ADR-009, ADR-015), leída de {@link TodayProvider}: todos los consumidores
 * comparten un solo timer y un solo listener de `AppState`.
 */
export function useToday(): LocalDate {
  const today = use(TodayContext);
  if (today === null) {
    throw new Error('useToday requires a TodayProvider above it in the tree.');
  }
  return today;
}

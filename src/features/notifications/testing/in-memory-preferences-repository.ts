import type { DataChanges } from '@/core/db/data-changes';
import { runAsPromise } from '@/core/db/run-as-promise';
import type { EpochMs } from '@/shared/domain';

import type { PreferencesRepository } from '../data/preferences-repository';
import { assertValidPreferences } from '../data/validate-preferences';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../domain/preferences';

/** Opciones de {@link createInMemoryPreferencesRepository}. */
export interface InMemoryPreferencesRepositoryOptions {
  readonly dataChanges: DataChanges;
}

/**
 * Doble en memoria de `PreferencesRepository`. Cumple la misma suite de contrato que la
 * implementación Drizzle y emite `notification_preferences` en cada `save`.
 */
export function createInMemoryPreferencesRepository({
  dataChanges,
}: InMemoryPreferencesRepositoryOptions): PreferencesRepository {
  let stored: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
  let lastWeeklyFireAt: EpochMs | null = null;

  return {
    get: () => runAsPromise(() => stored),
    save: (preferences) =>
      runAsPromise(() => {
        stored = assertValidPreferences(preferences);
        dataChanges.emit(new Set(['notification_preferences']));
      }),
    getLastWeeklyFireAt: () => runAsPromise(() => lastWeeklyFireAt),
    setLastWeeklyFireAt: (instant) =>
      runAsPromise(() => {
        lastWeeklyFireAt = instant;
      }),
  };
}

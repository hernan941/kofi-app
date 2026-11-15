import { epochMsSchema } from '@/shared/domain';
import type { TableName } from '@/core/db/table-names';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../domain/preferences';
import type { PreferencesRepository } from './preferences-repository';

/** Lo que la suite de contrato necesita de cada implementación. */
export interface PreferencesRepositoryHarness {
  readonly repository: PreferencesRepository;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el harness. */
  readonly emitted: ReadonlySet<TableName>[];
  dispose(): void;
}

const NOW = epochMsSchema.parse(1_700_000_000_000);
const CUSTOM: NotificationPreferences = {
  weekly: { enabled: false, weekday: 3, minuteOfDay: 510 },
  monthly: { enabled: false },
};

function withWeekly(weekly: Partial<NotificationPreferences['weekly']>): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, weekly: { ...CUSTOM.weekly, ...weekly } };
}

/** Suite de contrato de las preferencias; la corren Drizzle y el doble en memoria. */
export function runPreferencesRepositoryContract(
  createHarness: () => Promise<PreferencesRepositoryHarness> | PreferencesRepositoryHarness,
): void {
  let harness: PreferencesRepositoryHarness;
  let repository: PreferencesRepository;

  beforeEach(async () => {
    harness = await createHarness();
    repository = harness.repository;
  });

  afterEach(() => {
    harness.dispose();
  });

  it('returns the defaults when nothing was saved', async () => {
    await expect(repository.get()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('saves and reads the preferences back', async () => {
    await repository.save(CUSTOM, NOW);

    await expect(repository.get()).resolves.toEqual(CUSTOM);
  });

  it('keeps a single set of preferences when saving twice', async () => {
    await repository.save(CUSTOM, NOW);
    await repository.save(DEFAULT_NOTIFICATION_PREFERENCES, NOW);

    await expect(repository.get()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it.each([1, 7])('accepts weekday %p', async (weekday) => {
    const preferences = withWeekly({ weekday: weekday as 1 | 7 });
    await repository.save(preferences, NOW);

    await expect(repository.get()).resolves.toEqual(preferences);
  });

  it.each([0, 1439])('accepts minuteOfDay %p', async (minuteOfDay) => {
    const preferences = withWeekly({ minuteOfDay });
    await repository.save(preferences, NOW);

    await expect(repository.get()).resolves.toEqual(preferences);
  });

  it.each([
    ['weekday 0', { weekday: 0 }],
    ['weekday 8', { weekday: 8 }],
    ['minuteOfDay -1', { minuteOfDay: -1 }],
    ['minuteOfDay 1440', { minuteOfDay: 1440 }],
    ['a fractional minuteOfDay', { minuteOfDay: 12.5 }],
  ])('rejects %s without writing or emitting', async (_name, weekly) => {
    await expect(
      repository.save(withWeekly(weekly as Partial<NotificationPreferences['weekly']>), NOW),
    ).rejects.toThrow(RangeError);

    await expect(repository.get()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(harness.emitted).toEqual([]);
  });

  it('emits only notification_preferences on each save and never on reads', async () => {
    await repository.get();
    await repository.save(CUSTOM, NOW);
    await repository.save(CUSTOM, NOW);

    expect(harness.emitted).toEqual([
      new Set(['notification_preferences']),
      new Set(['notification_preferences']),
    ]);
  });

  it('has no last weekly fire instant at first', async () => {
    await expect(repository.getLastWeeklyFireAt()).resolves.toBeNull();
  });

  it('stores and clears the last weekly fire instant without touching the preferences', async () => {
    const instant = epochMsSchema.parse(1_700_100_000_000);
    await repository.setLastWeeklyFireAt(instant, NOW);

    await expect(repository.getLastWeeklyFireAt()).resolves.toBe(instant);
    await expect(repository.get()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);

    await repository.setLastWeeklyFireAt(null, NOW);

    await expect(repository.getLastWeeklyFireAt()).resolves.toBeNull();
  });

  it('keeps the last weekly fire instant when the preferences are saved', async () => {
    const instant = epochMsSchema.parse(1_700_100_000_000);
    await repository.setLastWeeklyFireAt(instant, NOW);
    await repository.save(CUSTOM, NOW);

    await expect(repository.getLastWeeklyFireAt()).resolves.toBe(instant);
    await expect(repository.get()).resolves.toEqual(CUSTOM);
  });

  it('does not emit when only the last weekly fire instant changes', async () => {
    await repository.setLastWeeklyFireAt(epochMsSchema.parse(1_700_100_000_000), NOW);

    expect(harness.emitted).toEqual([]);
  });
}

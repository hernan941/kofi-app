import type { BootFailure } from '@/core/db/configure-and-migrate';

import { bootReducer, isBootSettled, type BootEvent, type BootState } from './boot-machine';

const BOOTING: BootState = { phase: 'booting' };
const FOREIGN_KEYS: BootFailure = { kind: 'foreign_key_violation', violations: 2 };
const NEWER: BootFailure = { kind: 'newer_database', appliedMigrations: 3, knownMigrations: 1 };

function run(events: readonly BootEvent[], from: BootState = BOOTING): BootState {
  return events.reduce(bootReducer, from);
}

describe('bootReducer', () => {
  test('starts loading with both conditions pending', () => {
    expect(run([{ type: 'started' }])).toEqual({
      phase: 'loading',
      fonts: 'pending',
      database: 'pending',
    });
  });

  test('ignores events that arrive before the start', () => {
    expect(run([{ type: 'fonts_loaded' }, { type: 'database_ready' }])).toEqual(BOOTING);
  });

  test.each([
    ['fonts first', ['fonts_loaded', 'database_ready']],
    ['database first', ['database_ready', 'fonts_loaded']],
  ] as const)('is ready when both conditions are met (%s)', (_name, order) => {
    const events = order.map((type): BootEvent => ({ type }));

    expect(run([{ type: 'started' }, ...events])).toEqual({
      phase: 'ready',
      usingSystemFont: false,
    });
  });

  test('keeps loading while only one condition is met', () => {
    expect(run([{ type: 'started' }, { type: 'fonts_loaded' }])).toEqual({
      phase: 'loading',
      fonts: 'ready',
      database: 'pending',
    });
    expect(run([{ type: 'started' }, { type: 'database_ready' }])).toEqual({
      phase: 'loading',
      fonts: 'pending',
      database: 'ready',
    });
  });

  test.each([
    ['fonts_failed then database_ready', ['fonts_failed', 'database_ready']],
    ['database_ready then fonts_failed', ['database_ready', 'fonts_failed']],
  ] as const)('continues with the system font when the fonts fail (%s)', (_name, order) => {
    const events = order.map((type): BootEvent => ({ type }));

    expect(run([{ type: 'started' }, ...events])).toEqual({
      phase: 'ready',
      usingSystemFont: true,
    });
  });

  test('a database failure ends in failed whatever the order, and wins over the fonts', () => {
    const failed = { phase: 'failed', failure: FOREIGN_KEYS };
    const failure: BootEvent = { type: 'database_failed', failure: FOREIGN_KEYS };

    expect(run([{ type: 'started' }, failure])).toEqual(failed);
    expect(run([{ type: 'started' }, { type: 'fonts_loaded' }, failure])).toEqual(failed);
    expect(run([{ type: 'started' }, failure, { type: 'fonts_loaded' }])).toEqual(failed);
    expect(run([{ type: 'started' }, { type: 'fonts_failed' }, failure])).toEqual(failed);
  });

  test('keeps the kind of each failure', () => {
    expect(run([{ type: 'started' }, { type: 'database_failed', failure: NEWER }])).toEqual({
      phase: 'failed',
      failure: NEWER,
    });
  });

  test('ignores late events once the state is final', () => {
    const ready = run([{ type: 'started' }, { type: 'fonts_loaded' }, { type: 'database_ready' }]);
    const failed = run([{ type: 'started' }, { type: 'database_failed', failure: NEWER }]);

    expect(
      run([{ type: 'database_failed', failure: NEWER }, { type: 'fonts_failed' }], ready),
    ).toBe(ready);
    expect(run([{ type: 'database_ready' }, { type: 'started' }], failed)).toBe(failed);
  });
});

describe('isBootSettled', () => {
  test('is true only for ready and failed', () => {
    expect(isBootSettled(BOOTING)).toBe(false);
    expect(isBootSettled({ phase: 'loading', fonts: 'ready', database: 'pending' })).toBe(false);
    expect(isBootSettled({ phase: 'ready', usingSystemFont: false })).toBe(true);
    expect(isBootSettled({ phase: 'failed', failure: NEWER })).toBe(true);
  });
});

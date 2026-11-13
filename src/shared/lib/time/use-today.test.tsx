import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { DependenciesProvider } from '@/core/providers/dependencies-context';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { epochMsSchema } from '@/shared/domain/epoch-ms';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';
import { FakeClock } from '@/shared/domain/testing/fake-clock';

import { useCurrentWeek } from './use-current-week';
import { useToday } from './use-today';

const at = (iso: string) => epochMsSchema.parse(Date.parse(iso));

interface AppStateSpy {
  readonly emit: (status: AppStateStatus) => void;
  readonly remove: jest.Mock;
}

function spyOnAppState(): AppStateSpy {
  const remove = jest.fn();
  let handler: (status: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    handler = listener;
    return { remove };
  });
  return {
    emit: (status) => {
      handler(status);
    },
    remove,
  };
}

function wrapperFor(clock: FakeClock) {
  const dependencies = createTestDependencies({ clock });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DependenciesProvider dependencies={dependencies}>{children}</DependenciesProvider>;
  };
}

describe('useToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the local date of the clock', async () => {
    spyOnAppState();
    const clock = new FakeClock(at('2026-07-01T16:00:00Z'));

    const { result } = await renderHook(() => useToday(), { wrapper: wrapperFor(clock) });

    expect(result.current).toBe('2026-07-01');
  });

  test('changes when the clock crosses local midnight', async () => {
    spyOnAppState();
    const clock = new FakeClock(at('2026-07-02T03:30:00Z'));
    const { result } = await renderHook(() => useToday(), { wrapper: wrapperFor(clock) });
    expect(result.current).toBe('2026-07-01');

    await act(() => {
      advanceClockAndTimers(clock, 31 * 60_000);
    });

    expect(result.current).toBe('2026-07-02');
  });

  test('wakes up after at most one hour even if midnight is far away', async () => {
    spyOnAppState();
    const clock = new FakeClock(at('2026-07-01T14:00:00Z'));
    const { result } = await renderHook(() => useToday(), { wrapper: wrapperFor(clock) });

    clock.set(at('2026-07-03T14:00:00Z'));
    await act(() => {
      jest.advanceTimersByTime(59 * 60_000);
    });
    expect(result.current).toBe('2026-07-01');

    await act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe('2026-07-03');
  });

  test('recalculates when the app returns to the foreground', async () => {
    const appState = spyOnAppState();
    const clock = new FakeClock(at('2026-07-01T16:00:00Z'));
    const { result } = await renderHook(() => useToday(), { wrapper: wrapperFor(clock) });

    clock.set(at('2026-07-03T16:00:00Z'));
    await act(() => {
      appState.emit('active');
    });

    expect(result.current).toBe('2026-07-03');
  });

  test('ignores a change to the background', async () => {
    const appState = spyOnAppState();
    const clock = new FakeClock(at('2026-07-01T16:00:00Z'));
    const { result } = await renderHook(() => useToday(), { wrapper: wrapperFor(clock) });

    clock.set(at('2026-07-03T16:00:00Z'));
    await act(() => {
      appState.emit('background');
    });

    expect(result.current).toBe('2026-07-01');
  });

  test('clears the timer and the AppState listener on unmount', async () => {
    const appState = spyOnAppState();
    const clock = new FakeClock(at('2026-07-01T16:00:00Z'));
    const dependencies = createTestDependencies({ clock });
    const localDateOf = jest.spyOn(dependencies.calendar, 'localDateOf');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DependenciesProvider dependencies={dependencies}>{children}</DependenciesProvider>
    );
    const { unmount } = await renderHook(() => useToday(), { wrapper });
    const callsWhileMounted = localDateOf.mock.calls.length;

    await unmount();
    jest.advanceTimersByTime(3 * 3_600_000);

    expect(localDateOf).toHaveBeenCalledTimes(callsWhileMounted);
    expect(appState.remove).toHaveBeenCalledTimes(1);
  });
});

describe('useCurrentWeek', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    spyOnAppState();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the ISO week that contains today', async () => {
    const clock = new FakeClock(at('2026-11-12T16:00:00Z'));

    const { result } = await renderHook(() => useCurrentWeek(), { wrapper: wrapperFor(clock) });

    expect(result.current).toEqual({ start: '2026-11-09', end: '2026-11-15' });
  });

  test('changes between Sunday 23:59 and Monday 00:00', async () => {
    const clock = new FakeClock(at('2026-11-16T02:59:00Z'));
    const { result } = await renderHook(() => useCurrentWeek(), { wrapper: wrapperFor(clock) });
    expect(result.current.start).toBe('2026-11-09');

    await act(() => {
      advanceClockAndTimers(clock, 60_000);
    });

    expect(result.current).toEqual({ start: '2026-11-16', end: '2026-11-22' });
  });
});

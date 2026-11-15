import { renderHook } from '@testing-library/react-native';

import { usePreventLeave } from './use-prevent-leave';

type PreventRemoveCallback = (options: { data: { action: unknown }; repeat: () => void }) => void;

const mockUsePreventRemove = jest.fn<
  unknown,
  [prevent: boolean, callback: PreventRemoveCallback]
>();
jest.mock('expo-router', () => ({
  usePreventRemove: (prevent: boolean, callback: PreventRemoveCallback) => {
    mockUsePreventRemove(prevent, callback);
  },
}));

function lastPrevent(): boolean {
  return mockUsePreventRemove.mock.calls.at(-1)?.[0] ?? false;
}

function tryToLeave(): void {
  mockUsePreventRemove.mock.calls.at(-1)?.[1]({ data: { action: {} }, repeat: jest.fn() });
}

describe('usePreventLeave', () => {
  it('does not prevent leaving when it is not active', async () => {
    await renderHook(() => {
      usePreventLeave(false, jest.fn());
    });

    expect(lastPrevent()).toBe(false);
  });

  it('prevents leaving and tells the screen when it is active', async () => {
    const onBlocked = jest.fn();
    await renderHook(() => {
      usePreventLeave(true, onBlocked);
    });

    expect(lastPrevent()).toBe(true);
    tryToLeave();

    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('calls the latest handler', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ handler }: { handler: () => void }) => {
        usePreventLeave(true, handler);
      },
      { initialProps: { handler: first } },
    );

    await rerender({ handler: second });
    tryToLeave();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops preventing when it turns inactive', async () => {
    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) => {
        usePreventLeave(active, jest.fn());
      },
      { initialProps: { active: true } },
    );

    await rerender({ active: false });

    expect(lastPrevent()).toBe(false);
  });
});

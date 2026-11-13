import { act, renderHook } from '@testing-library/react-native';

import { useFinishOnLeave } from './use-finish-on-leave';

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
  const callback = mockUsePreventRemove.mock.calls.at(-1)?.[1];
  callback?.({ data: { action: {} }, repeat: jest.fn() });
}

describe('useFinishOnLeave', () => {
  it('does not intercept leaving while it is not active', async () => {
    await renderHook(() => useFinishOnLeave(false, jest.fn()));

    expect(lastPrevent()).toBe(false);
  });

  it('intercepts leaving while active', async () => {
    await renderHook(() => useFinishOnLeave(true, jest.fn()));

    expect(lastPrevent()).toBe(true);
  });

  it('finishes instead of leaving when the person tries to go back, after releasing the block', async () => {
    const onFinish = jest.fn();
    await renderHook(() => useFinishOnLeave(true, onFinish));

    await act(() => {
      tryToLeave();
    });

    expect(lastPrevent()).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('finishes when asked to, releasing the block first', async () => {
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useFinishOnLeave(true, onFinish));

    await act(() => {
      result.current();
    });

    expect(lastPrevent()).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('finishes only once even if asked several times', async () => {
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useFinishOnLeave(true, onFinish));

    await act(() => {
      result.current();
      result.current();
      tryToLeave();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

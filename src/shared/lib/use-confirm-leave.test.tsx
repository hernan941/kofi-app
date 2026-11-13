import { act, renderHook } from '@testing-library/react-native';

import { useConfirmLeave } from './use-confirm-leave';

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

function tryToLeave(repeat: () => void): void {
  const callback = mockUsePreventRemove.mock.calls.at(-1)?.[1];
  callback?.({ data: { action: {} }, repeat });
}

describe('useConfirmLeave', () => {
  it('does not prevent leaving without changes', async () => {
    await renderHook(() => useConfirmLeave(false));

    expect(lastPrevent()).toBe(false);
  });

  it('opens the dialog when leaving with changes and leaves on confirm', async () => {
    const repeat = jest.fn();
    const { result } = await renderHook(() => useConfirmLeave(true));
    expect(lastPrevent()).toBe(true);
    expect(result.current.isOpen).toBe(false);

    await act(() => {
      tryToLeave(repeat);
    });
    expect(result.current.isOpen).toBe(true);

    await act(() => {
      result.current.confirm();
    });
    expect(result.current.isOpen).toBe(false);
    expect(lastPrevent()).toBe(false);
    expect(repeat).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog and stays when cancelled', async () => {
    const repeat = jest.fn();
    const { result } = await renderHook(() => useConfirmLeave(true));
    await act(() => {
      tryToLeave(repeat);
    });

    await act(() => {
      result.current.cancel();
    });

    expect(result.current.isOpen).toBe(false);
    expect(lastPrevent()).toBe(true);
    expect(repeat).not.toHaveBeenCalled();
  });

  it('runs an action without asking once the prevention is released', async () => {
    const action = jest.fn();
    const { result } = await renderHook(() => useConfirmLeave(true));

    await act(() => {
      result.current.leaveWithoutAsking(action);
    });

    expect(lastPrevent()).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('runs the action of every call, also after the prevention was already released', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result } = await renderHook(() => useConfirmLeave(true));
    await act(() => {
      result.current.leaveWithoutAsking(first);
    });

    await act(() => {
      result.current.leaveWithoutAsking(second);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

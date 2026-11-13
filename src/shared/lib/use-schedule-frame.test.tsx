import { renderHook } from '@testing-library/react-native';

import { useScheduleFrame } from './use-schedule-frame';

describe('useScheduleFrame', () => {
  let nextHandle = 0;
  let pending: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    nextHandle = 0;
    pending = new Map();
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      nextHandle += 1;
      pending.set(nextHandle, callback);
      return nextHandle;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((handle) => {
      pending.delete(handle);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the work on the next frame', () => {
    const work = jest.fn();
    const { result } = renderHook(() => useScheduleFrame());

    result.current(work);
    expect(work).not.toHaveBeenCalled();
    pending.forEach((callback) => {
      callback(0);
    });

    expect(work).toHaveBeenCalledTimes(1);
  });

  it('cancels the frames that are still pending when it unmounts', () => {
    const work = jest.fn();
    const { result, unmount } = renderHook(() => useScheduleFrame());
    result.current(work);

    unmount();

    expect(pending.size).toBe(0);
    expect(work).not.toHaveBeenCalled();
  });
});

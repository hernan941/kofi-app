import { act } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import type { NotificationTarget } from '../domain/payload';
import { fakeTap } from '../testing/fake-notification-responses';
import { useNotificationTaps } from './use-notification-taps';

const SALES_DATA = { v: 1, deepLink: '/sales/new' };
const MONTHLY_DATA = { v: 1, deepLink: '/tracking/monthly', month: '2026-11' };

interface ProbeProps {
  readonly navigationReady: boolean;
  readonly onOpen: (target: NotificationTarget | null) => void;
}

function Probe({ navigationReady, onOpen }: ProbeProps) {
  useNotificationTaps({ navigationReady, onOpen });
  return null;
}

async function setup(navigationReady = true) {
  const dependencies = createTestDependencies();
  const onOpen = jest.fn();
  const view = await renderWithProviders(
    <Probe navigationReady={navigationReady} onOpen={onOpen} />,
    {
      dependencies,
    },
  );
  const rerender = (ready: boolean) =>
    view.rerender(<Probe navigationReady={ready} onOpen={onOpen} />);
  return { responses: dependencies.notificationResponses, onOpen, view, rerender };
}

describe('useNotificationTaps', () => {
  it('opens the sale registration for a valid weekly payload', async () => {
    const { responses, onOpen } = await setup();

    await act(() => {
      responses.emit(fakeTap('cv.weekly.repeat@1', SALES_DATA));
    });

    expect(onOpen).toHaveBeenCalledWith({ deepLink: '/sales/new' });
  });

  it('opens the monthly summary with its month', async () => {
    const { responses, onOpen } = await setup();

    await act(() => {
      responses.emit(fakeTap('cv.monthly.2026-12@1', MONTHLY_DATA));
    });

    expect(onOpen).toHaveBeenCalledWith({ deepLink: '/tracking/monthly', month: '2026-11' });
  });

  it('opens Home (null target) when the payload is invalid', async () => {
    const { responses, onOpen } = await setup();

    await act(() => {
      responses.emit(fakeTap('cv.x@1', { deepLink: '/somewhere/else' }));
    });

    expect(onOpen).toHaveBeenCalledWith(null);
  });

  it('handles the last response of a cold start', async () => {
    const dependencies = createTestDependencies();
    dependencies.notificationResponses.setLast(fakeTap('cv.weekly.repeat@5', SALES_DATA));
    const onOpen = jest.fn();

    await renderWithProviders(<Probe navigationReady onOpen={onOpen} />, { dependencies });

    expect(onOpen).toHaveBeenCalledWith({ deepLink: '/sales/new' });
  });

  it('processes the same response once when it arrives by both ways, then clears it', async () => {
    const dependencies = createTestDependencies();
    const { notificationResponses: responses } = dependencies;
    const tap = fakeTap('cv.weekly.repeat@5', SALES_DATA);
    responses.setLast(tap);
    const onOpen = jest.fn();
    await renderWithProviders(<Probe navigationReady onOpen={onOpen} />, { dependencies });

    await act(() => {
      responses.emit(tap);
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(responses.clearCount).toBe(1);
  });

  it('processes the same identifier again when the delivery date differs', async () => {
    const { responses, onOpen } = await setup();

    await act(() => {
      responses.emit(fakeTap('cv.weekly.repeat@1', SALES_DATA));
    });
    await act(() => {
      responses.emit(fakeTap('cv.weekly.repeat@2', SALES_DATA));
    });

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('does not navigate before the root navigator is ready, and does it once it is', async () => {
    const { responses, onOpen, rerender } = await setup(false);

    await act(() => {
      responses.emit(fakeTap('cv.weekly.repeat@1', SALES_DATA));
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(responses.clearCount).toBe(0);

    await rerender(true);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(responses.clearCount).toBe(1);
  });

  it('ignores responses to actions other than the default one', async () => {
    const { responses, onOpen } = await setup();

    await act(() => {
      responses.emit(fakeTap('cv.weekly.repeat@1', SALES_DATA, false));
    });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount', async () => {
    const { responses, view } = await setup();
    expect(responses.listenerCount).toBe(1);

    await view.unmount();

    expect(responses.listenerCount).toBe(0);
  });
});

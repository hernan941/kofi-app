import * as Notifications from 'expo-notifications';

import { createExpoNotificationResponses } from './expo-notification-responses';

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
}));

const mocked = jest.mocked(Notifications);

function response(
  identifier: string,
  date: number,
  actionIdentifier = Notifications.DEFAULT_ACTION_IDENTIFIER,
) {
  return {
    actionIdentifier,
    notification: {
      date,
      request: { identifier, content: { data: { deepLink: '/sales/new' } }, trigger: null },
    },
  } as never;
}

describe('createExpoNotificationResponses', () => {
  it('returns null when there is no last response', () => {
    mocked.getLastNotificationResponse.mockReturnValue(null);

    expect(createExpoNotificationResponses().getLast()).toBeNull();
  });

  it('normalizes the last response with identifier plus delivery date as key', () => {
    mocked.getLastNotificationResponse.mockReturnValue(response('cv.weekly.repeat', 1_700));

    expect(createExpoNotificationResponses().getLast()).toEqual({
      key: 'cv.weekly.repeat@1700',
      isDefaultAction: true,
      data: { deepLink: '/sales/new' },
    });
  });

  it('marks a response to a custom action as not default', () => {
    mocked.getLastNotificationResponse.mockReturnValue(
      response('cv.weekly.repeat', 1, 'some.other.action'),
    );

    expect(createExpoNotificationResponses().getLast()?.isDefaultAction).toBe(false);
  });

  it('forwards the responses received while the app is open and removes the listener', () => {
    const remove = jest.fn();
    let received: ((value: Notifications.NotificationResponse) => void) | undefined;
    mocked.addNotificationResponseReceivedListener.mockImplementation((listener) => {
      received = listener;
      return { remove };
    });
    const listener = jest.fn();

    const unsubscribe = createExpoNotificationResponses().subscribe(listener);
    received?.(response('cv.monthly.2026-12', 9));

    expect(listener).toHaveBeenCalledWith({
      key: 'cv.monthly.2026-12@9',
      isDefaultAction: true,
      data: { deepLink: '/sales/new' },
    });
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('clears the last response so it does not repeat on the next launch', async () => {
    await createExpoNotificationResponses().clearLast();

    expect(mocked.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });
});

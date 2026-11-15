import * as Notifications from 'expo-notifications';

import { installNotificationPresentation } from './notification-presentation';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));

describe('installNotificationPresentation', () => {
  it('shows a banner and the list entry without sound or badge while the app is open', async () => {
    installNotificationPresentation();

    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];
    expect(handler).toBeDefined();
    await expect(handler?.handleNotification({} as never)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});

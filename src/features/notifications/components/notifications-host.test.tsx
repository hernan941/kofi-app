import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { fakeTap } from '../testing/fake-notification-responses';
import { NotificationsHost } from './notifications-host';

describe('NotificationsHost', () => {
  it('reconciles on mount and handles the cold-start tap', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('granted');
    dependencies.notificationResponses.setLast(
      fakeTap('cv.weekly.repeat@1', { v: 1, deepLink: '/sales/new' }),
    );
    const onOpen = jest.fn();

    await renderWithProviders(<NotificationsHost navigationReady onOpen={onOpen} />, {
      dependencies,
    });

    expect(onOpen).toHaveBeenCalledWith({ deepLink: '/sales/new' });
    expect(dependencies.notifications.operations.map(({ type }) => type)).toContain('permission');
  });
});

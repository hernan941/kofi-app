import { rootKeysToInvalidate } from '@/core/providers/query/root-keys-to-invalidate';

import { NOTIFICATIONS_QUERY_DEPENDENCIES, notificationKeys } from './query-keys';

describe('notification query keys', () => {
  it('has stable keys', () => {
    expect(notificationKeys.preferences()).toEqual(['notification-preferences']);
    expect(notificationKeys.permission()).toEqual(['notification-permission']);
  });

  it('reloads the preferences, and only them, when notification_preferences changes', () => {
    expect(
      rootKeysToInvalidate(NOTIFICATIONS_QUERY_DEPENDENCIES, new Set(['notification_preferences'])),
    ).toEqual([['notification-preferences']]);
  });

  it('never invalidates the permission, whatever the table', () => {
    expect(
      rootKeysToInvalidate(
        NOTIFICATIONS_QUERY_DEPENDENCIES,
        new Set(['notification_preferences', 'sale_records', 'sale_items']),
      ),
    ).not.toContainEqual(['notification-permission']);
  });
});

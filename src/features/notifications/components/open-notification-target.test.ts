import { yearMonthSchema } from '@/shared/domain';

import { openNotificationTarget } from './open-notification-target';

function router() {
  return { push: jest.fn(), navigate: jest.fn() };
}

describe('openNotificationTarget', () => {
  it('opens the sale registration', () => {
    const target = router();

    openNotificationTarget(target, { deepLink: '/sales/new' });

    expect(target.push).toHaveBeenCalledWith('/sales/new');
  });

  it('opens the monthly summary of the month in the notice', () => {
    const target = router();

    openNotificationTarget(target, {
      deepLink: '/tracking/monthly',
      month: yearMonthSchema.parse('2026-11'),
    });

    expect(target.push).toHaveBeenCalledWith({
      pathname: '/tracking/monthly',
      params: { month: '2026-11' },
    });
  });

  it('opens Home when the payload was not valid', () => {
    const target = router();

    openNotificationTarget(target, null);

    expect(target.navigate).toHaveBeenCalledWith('/');
    expect(target.push).not.toHaveBeenCalled();
  });
});

import { LATEST_SALES_LIMIT } from './latest-sales';

describe('LATEST_SALES_LIMIT', () => {
  test('Home shows the five latest sales', () => {
    expect(LATEST_SALES_LIMIT).toBe(5);
  });
});

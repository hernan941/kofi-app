import { shouldOfferPermission } from './permission';

describe('shouldOfferPermission', () => {
  test.each([
    [true, 'undetermined', true],
    [true, 'granted', false],
    [true, 'denied', false],
    [true, undefined, false],
    [false, 'undetermined', false],
  ] as const)('first sale %p with %p is %p', (isFirstSale, permission, expected) => {
    expect(shouldOfferPermission({ isFirstSale, permission })).toBe(expected);
  });
});

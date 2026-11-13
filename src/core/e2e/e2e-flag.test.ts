import type * as E2eFlagModule from './e2e-flag';
import { isE2EBuild, isE2EFlag } from './e2e-flag';

describe('isE2EFlag', () => {
  test("is true only for exactly '1'", () => {
    expect(isE2EFlag('1')).toBe(true);
  });

  test.each([undefined, '', '0', 'true', 'TRUE', 'yes', ' 1', '1 ', '11'])(
    'is false for %j',
    (value) => {
      expect(isE2EFlag(value)).toBe(false);
    },
  );
});

describe('isE2EBuild', () => {
  test('is false when EXPO_PUBLIC_E2E is not set', () => {
    expect(process.env.EXPO_PUBLIC_E2E).toBeUndefined();
    expect(isE2EBuild).toBe(false);
  });

  test("is true when the module loads with EXPO_PUBLIC_E2E set to '1'", () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    try {
      jest.isolateModules(() => {
        const flag = jest.requireActual<typeof E2eFlagModule>('./e2e-flag');
        expect(flag.isE2EBuild).toBe(true);
      });
    } finally {
      delete process.env.EXPO_PUBLIC_E2E;
    }
  });
});

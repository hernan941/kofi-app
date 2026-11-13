import { resolveNativeIntentPath } from './native-intent';

describe('resolveNativeIntentPath without the E2E flag', () => {
  test.each([
    'cuantovendi://e2e/seed?fixture=basic',
    'cuantovendi://e2e/diagnostics',
    'cuantovendi:///e2e/diagnostics',
    '/e2e/diagnostics',
    '/e2e',
    'e2e/seed',
    'CUANTOVENDI://E2E/seed',
    '/e2e?x=1',
  ])('sends %s to the home tab', (path) => {
    expect(resolveNativeIntentPath(path, false)).toBe('/');
  });

  test.each([
    '/',
    '/products',
    'cuantovendi://tips/after-sale',
    'cuantovendi://e2ex/seed',
    '/tips/e2e',
    '/e2e-notes',
  ])('keeps %s', (path) => {
    expect(resolveNativeIntentPath(path, false)).toBe(path);
  });
});

describe('resolveNativeIntentPath with the E2E flag', () => {
  test('keeps the E2E paths', () => {
    expect(resolveNativeIntentPath('cuantovendi://e2e/seed?fixture=basic', true)).toBe(
      'cuantovendi://e2e/seed?fixture=basic',
    );
  });
});

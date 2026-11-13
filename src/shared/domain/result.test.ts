import { err, ok, type Result } from './result';

describe('Result', () => {
  test('ok wraps a value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  test('err wraps an error', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  test('narrows on the ok flag', () => {
    const describeResult = (result: Result<number, string>): string =>
      result.ok ? `value ${String(result.value)}` : `error ${result.error}`;

    expect(describeResult(ok(1))).toBe('value 1');
    expect(describeResult(err('boom'))).toBe('error boom');
  });
});

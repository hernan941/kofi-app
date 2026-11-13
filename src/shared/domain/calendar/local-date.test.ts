import { localDateSchema } from './local-date';

describe('localDateSchema', () => {
  test.each(['2026-11-13', '2028-02-29', '2026-12-31', '0001-01-01'])('accepts %s', (value) => {
    expect(localDateSchema.safeParse(value).success).toBe(true);
  });

  test.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-2-3',
    '26-02-03',
    '2026-02-03T10:00:00',
    '2026-02-03 10:00',
    '2026-02-03Z',
    ' 2026-02-03',
    '',
    20260203,
  ])('rejects %p', (value) => {
    expect(localDateSchema.safeParse(value).success).toBe(false);
  });
});

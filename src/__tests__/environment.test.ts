describe('ui project', () => {
  test('runs in the configured time zone', () => {
    const expected = process.env.TEST_TZ ?? 'America/Santiago';

    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(expected);
  });
});

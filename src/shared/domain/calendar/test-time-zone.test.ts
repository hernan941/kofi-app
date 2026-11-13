const EXPECTED_TIME_ZONE = process.env.TEST_TZ ?? 'America/Santiago';

const EXPECTED_OFFSET_MINUTES: Record<string, number> = {
  'America/Santiago': 240,
  'Pacific/Easter': 360,
  'America/Punta_Arenas': 180,
};

describe('test time zone', () => {
  test('the configured time zone is the active one', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(EXPECTED_TIME_ZONE);
  });

  test('dates are interpreted in the configured time zone', () => {
    const winterNoonUtc = new Date('2026-07-01T12:00:00Z');

    expect(winterNoonUtc.getTimezoneOffset()).toBe(EXPECTED_OFFSET_MINUTES[EXPECTED_TIME_ZONE]);
  });
});

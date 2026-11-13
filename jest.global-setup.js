const DEFAULT_TEST_TIME_ZONE = 'America/Santiago';

/**
 * Pins the process time zone for every Jest project (ADR-013, ADR-015). The `TEST_TZ`
 * variable lets `npm run test:tz` repeat the calendar tests in the other Chilean zones.
 */
module.exports = function globalSetup() {
  process.env.TZ = process.env.TEST_TZ || DEFAULT_TEST_TIME_ZONE;
};

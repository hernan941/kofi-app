/** Zonas horarias en las que se repiten los tests de fechas (ADR-015). */
export type FixtureTimeZone = 'America/Santiago' | 'Pacific/Easter' | 'America/Punta_Arenas';

/** Instante (ISO UTC) y la fecha y minuto de pared locales que deben corresponderle. */
export interface LocalDateCase {
  readonly instant: string;
  readonly date: string;
  readonly minuteOfDay: number;
}

/** Hora de pared local y el instante (ISO UTC) que `instantAt` debe devolver. */
export interface InstantAtCase {
  readonly description: string;
  readonly date: string;
  readonly minuteOfDay: number;
  readonly expected: string;
}

/** Instante de partida y la próxima medianoche local esperada, ambos en ISO UTC. */
export interface NextMidnightCase {
  readonly description: string;
  readonly from: string;
  readonly expected: string;
}

/**
 * Casos esperados para una zona, tomados de la base IANA de 2026: Santiago y Pascua
 * cambian de hora el 4-5 de abril y el 5-6 de septiembre; Punta Arenas no cambia.
 */
export interface TimeZoneFixture {
  readonly zone: FixtureTimeZone;
  readonly winterOffsetMinutes: number;
  readonly localDates: readonly LocalDateCase[];
  readonly instantAt: readonly InstantAtCase[];
  readonly nextMidnight: readonly NextMidnightCase[];
  readonly dstDays: readonly string[];
}

const SANTIAGO: TimeZoneFixture = {
  zone: 'America/Santiago',
  winterOffsetMinutes: 240,
  dstDays: ['2026-04-04', '2026-04-05', '2026-09-05', '2026-09-06'],
  localDates: [
    { instant: '2026-07-02T03:30:00Z', date: '2026-07-01', minuteOfDay: 1410 },
    { instant: '2026-07-01T04:00:00Z', date: '2026-07-01', minuteOfDay: 0 },
    { instant: '2026-01-15T02:59:00Z', date: '2026-01-14', minuteOfDay: 1439 },
    { instant: '2026-01-15T03:00:00Z', date: '2026-01-15', minuteOfDay: 0 },
    { instant: '2026-09-06T04:00:00Z', date: '2026-09-06', minuteOfDay: 60 },
    { instant: '2026-04-05T02:30:00Z', date: '2026-04-04', minuteOfDay: 1410 },
    { instant: '2026-04-05T03:30:00Z', date: '2026-04-04', minuteOfDay: 1410 },
  ],
  instantAt: [
    {
      description: 'winter noon',
      date: '2026-07-01',
      minuteOfDay: 720,
      expected: '2026-07-01T16:00:00Z',
    },
    {
      description: 'summer noon',
      date: '2026-01-15',
      minuteOfDay: 720,
      expected: '2026-01-15T15:00:00Z',
    },
    {
      description: 'nonexistent 00:00',
      date: '2026-09-06',
      minuteOfDay: 0,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'nonexistent 00:30',
      date: '2026-09-06',
      minuteOfDay: 30,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'first valid minute',
      date: '2026-09-06',
      minuteOfDay: 60,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'minute after the gap',
      date: '2026-09-06',
      minuteOfDay: 61,
      expected: '2026-09-06T04:01:00Z',
    },
    {
      description: 'repeated 23:00',
      date: '2026-04-04',
      minuteOfDay: 1380,
      expected: '2026-04-05T02:00:00Z',
    },
    {
      description: 'repeated 23:30',
      date: '2026-04-04',
      minuteOfDay: 1410,
      expected: '2026-04-05T02:30:00Z',
    },
    {
      description: 'repeated 23:59',
      date: '2026-04-04',
      minuteOfDay: 1439,
      expected: '2026-04-05T02:59:00Z',
    },
    {
      description: 'midnight after the repeat',
      date: '2026-04-05',
      minuteOfDay: 0,
      expected: '2026-04-05T04:00:00Z',
    },
  ],
  nextMidnight: [
    {
      description: 'before the forward jump',
      from: '2026-09-05T15:00:00Z',
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'before the backward jump',
      from: '2026-04-04T15:00:00Z',
      expected: '2026-04-05T04:00:00Z',
    },
    { description: 'first 23:30', from: '2026-04-05T02:30:00Z', expected: '2026-04-05T04:00:00Z' },
    { description: 'second 23:30', from: '2026-04-05T03:30:00Z', expected: '2026-04-05T04:00:00Z' },
    {
      description: 'exactly at midnight',
      from: '2026-07-01T04:00:00Z',
      expected: '2026-07-02T04:00:00Z',
    },
  ],
};

const EASTER: TimeZoneFixture = {
  zone: 'Pacific/Easter',
  winterOffsetMinutes: 360,
  dstDays: ['2026-04-04', '2026-04-05', '2026-09-05', '2026-09-06'],
  localDates: [
    { instant: '2026-07-02T05:30:00Z', date: '2026-07-01', minuteOfDay: 1410 },
    { instant: '2026-07-01T06:00:00Z', date: '2026-07-01', minuteOfDay: 0 },
    { instant: '2026-01-15T04:59:00Z', date: '2026-01-14', minuteOfDay: 1439 },
    { instant: '2026-01-15T05:00:00Z', date: '2026-01-15', minuteOfDay: 0 },
    { instant: '2026-09-06T04:00:00Z', date: '2026-09-05', minuteOfDay: 1380 },
    { instant: '2026-04-05T02:30:00Z', date: '2026-04-04', minuteOfDay: 1290 },
    { instant: '2026-04-05T03:30:00Z', date: '2026-04-04', minuteOfDay: 1290 },
  ],
  instantAt: [
    {
      description: 'winter noon',
      date: '2026-07-01',
      minuteOfDay: 720,
      expected: '2026-07-01T18:00:00Z',
    },
    {
      description: 'summer noon',
      date: '2026-01-15',
      minuteOfDay: 720,
      expected: '2026-01-15T17:00:00Z',
    },
    {
      description: 'nonexistent 22:00',
      date: '2026-09-05',
      minuteOfDay: 1320,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'nonexistent 22:30',
      date: '2026-09-05',
      minuteOfDay: 1350,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'first valid minute',
      date: '2026-09-05',
      minuteOfDay: 1380,
      expected: '2026-09-06T04:00:00Z',
    },
    {
      description: 'repeated 21:00',
      date: '2026-04-04',
      minuteOfDay: 1260,
      expected: '2026-04-05T02:00:00Z',
    },
    {
      description: 'repeated 21:30',
      date: '2026-04-04',
      minuteOfDay: 1290,
      expected: '2026-04-05T02:30:00Z',
    },
    {
      description: 'midnight after the gap day',
      date: '2026-09-06',
      minuteOfDay: 0,
      expected: '2026-09-06T05:00:00Z',
    },
  ],
  nextMidnight: [
    {
      description: 'before the forward jump',
      from: '2026-09-05T15:00:00Z',
      expected: '2026-09-06T05:00:00Z',
    },
    {
      description: 'before the backward jump',
      from: '2026-04-04T17:00:00Z',
      expected: '2026-04-05T06:00:00Z',
    },
    { description: 'second 21:30', from: '2026-04-05T03:30:00Z', expected: '2026-04-05T06:00:00Z' },
  ],
};

const PUNTA_ARENAS: TimeZoneFixture = {
  zone: 'America/Punta_Arenas',
  winterOffsetMinutes: 180,
  dstDays: ['2026-04-04', '2026-04-05', '2026-09-05', '2026-09-06'],
  localDates: [
    { instant: '2026-07-02T02:30:00Z', date: '2026-07-01', minuteOfDay: 1410 },
    { instant: '2026-07-01T03:00:00Z', date: '2026-07-01', minuteOfDay: 0 },
    { instant: '2026-09-06T03:00:00Z', date: '2026-09-06', minuteOfDay: 0 },
  ],
  instantAt: [
    { description: 'noon', date: '2026-07-01', minuteOfDay: 720, expected: '2026-07-01T15:00:00Z' },
    {
      description: 'midnight of the Santiago forward jump',
      date: '2026-09-06',
      minuteOfDay: 0,
      expected: '2026-09-06T03:00:00Z',
    },
    {
      description: 'midnight of the Santiago backward jump',
      date: '2026-04-05',
      minuteOfDay: 0,
      expected: '2026-04-05T03:00:00Z',
    },
    {
      description: 'late night of the Santiago backward jump',
      date: '2026-04-04',
      minuteOfDay: 1410,
      expected: '2026-04-05T02:30:00Z',
    },
  ],
  nextMidnight: [
    {
      description: 'across the Santiago forward jump',
      from: '2026-09-05T15:00:00Z',
      expected: '2026-09-06T03:00:00Z',
    },
    {
      description: 'across the Santiago backward jump',
      from: '2026-04-04T15:00:00Z',
      expected: '2026-04-05T03:00:00Z',
    },
  ],
};

/** Fixtures por zona; el test elige la de `TEST_TZ`. */
export const TIME_ZONE_FIXTURES: Readonly<Record<FixtureTimeZone, TimeZoneFixture>> = {
  'America/Santiago': SANTIAGO,
  'Pacific/Easter': EASTER,
  'America/Punta_Arenas': PUNTA_ARENAS,
};

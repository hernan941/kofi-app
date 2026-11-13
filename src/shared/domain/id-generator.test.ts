import { epochMsSchema } from './epoch-ms';
import {
  NAMESPACE_CUANTOVENDI,
  createUuidV7Generator,
  deterministicId,
  noSalesWeekIdSchema,
  uuidSchema,
} from './ids';
import { FakeClock } from './testing/fake-clock';
import { fakeRandomSource } from './testing/fake-random-source';
import { SequentialIdGenerator } from './testing/sequential-id-generator';

const START = epochMsSchema.parse(1_760_000_000_000);
const RANDOM_BYTES = Uint8Array.from({ length: 16 }, (_unused, index) => (index * 17 + 3) % 256);
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createUuidV7Generator', () => {
  test('returns a lowercase UUIDv7 with the RFC 9562 variant accepted by uuidSchema', () => {
    const generator = createUuidV7Generator(new FakeClock(START), fakeRandomSource(RANDOM_BYTES));

    const id = generator.next();

    expect(id).toMatch(UUID_V7_PATTERN);
    expect(uuidSchema.safeParse(id).success).toBe(true);
  });

  test('puts the clock instant in the first 48 bits', () => {
    const generator = createUuidV7Generator(new FakeClock(START), fakeRandomSource(RANDOM_BYTES));

    const hex = generator.next().replaceAll('-', '').slice(0, 12);

    expect(parseInt(hex, 16)).toBe(START);
  });

  test('takes the random bits from the injected source', () => {
    const generator = createUuidV7Generator(new FakeClock(START), fakeRandomSource(RANDOM_BYTES));

    const hex = generator.next().replaceAll('-', '');

    expect(hex.slice(22)).toBe(
      Array.from(RANDOM_BYTES.slice(11), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
  });

  test('different random bytes give different ids in the same millisecond', () => {
    const clock = new FakeClock(START);
    const other = Uint8Array.from(RANDOM_BYTES, (byte) => 255 - byte);

    const first = createUuidV7Generator(clock, fakeRandomSource(RANDOM_BYTES)).next();
    const second = createUuidV7Generator(clock, fakeRandomSource(other)).next();

    expect(first).not.toBe(second);
  });

  test('follows the clock', () => {
    const clock = new FakeClock(START);
    const generator = createUuidV7Generator(clock, fakeRandomSource(RANDOM_BYTES));

    clock.advance(5000);
    const hex = generator.next().replaceAll('-', '').slice(0, 12);

    expect(parseInt(hex, 16)).toBe(START + 5000);
  });

  test('does not touch the global crypto.getRandomValues', () => {
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('global crypto must not be used');
    });
    const generator = createUuidV7Generator(new FakeClock(START), fakeRandomSource(RANDOM_BYTES));

    expect(() => generator.next()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  test('asks the source for 16 bytes each time', () => {
    const random = jest.fn(() => RANDOM_BYTES);
    const generator = createUuidV7Generator(new FakeClock(START), random);

    generator.next();
    generator.next();

    expect(random).toHaveBeenCalledTimes(2);
    expect(random).toHaveBeenCalledWith(16);
  });
});

describe('deterministicId', () => {
  test('is stable for the same key and a valid lowercase UUIDv5', () => {
    const first = deterministicId('2026-11-09');

    expect(deterministicId('2026-11-09')).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(noSalesWeekIdSchema.safeParse(first).success).toBe(true);
  });

  test('differs between keys', () => {
    expect(deterministicId('2026-11-09')).not.toBe(deterministicId('2026-11-16'));
  });

  test('matches the UUIDv5 computed independently for the app namespace', () => {
    expect(NAMESPACE_CUANTOVENDI).toMatch(/^[0-9a-f-]{36}$/);
    expect(deterministicId('2026-11-09')).toBe('b5a6ee88-e9ca-5743-bd2a-12247efe3be7');
  });
});

describe('SequentialIdGenerator', () => {
  test('produces increasing, valid UUIDv7-shaped ids', () => {
    const generator = new SequentialIdGenerator();

    const ids = [generator.next(), generator.next(), generator.next()];

    expect(ids[0]).toBe('00000000-0000-7000-8000-000000000001');
    expect(ids[2]).toBe('00000000-0000-7000-8000-000000000003');
    ids.forEach((id) => {
      expect(id).toMatch(UUID_V7_PATTERN);
      expect(uuidSchema.safeParse(id).success).toBe(true);
    });
    expect([...ids].sort()).toEqual(ids);
  });

  test('another instance repeats the sequence', () => {
    expect(new SequentialIdGenerator().next()).toBe(new SequentialIdGenerator().next());
  });
});

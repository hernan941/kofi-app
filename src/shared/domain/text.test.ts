import { optionalTextSchema, requiredTextSchema } from './text';

describe('requiredTextSchema', () => {
  const schema = requiredTextSchema(5);

  test('trims surrounding whitespace', () => {
    expect(schema.parse('  hola  ')).toBe('hola');
  });

  test.each(['', '   ', '\n\t'])('rejects empty text %p', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  test('accepts text of exactly the maximum length', () => {
    expect(schema.parse('abcde')).toBe('abcde');
  });

  test('measures the length after trimming', () => {
    expect(schema.parse('  abcde  ')).toBe('abcde');
  });

  test('rejects text above the maximum length', () => {
    expect(schema.safeParse('abcdef').success).toBe(false);
  });

  test('reports stable error codes', () => {
    const empty = schema.safeParse(' ');
    const long = schema.safeParse('abcdef');

    expect(empty.error?.issues[0]?.message).toBe('required');
    expect(long.error?.issues[0]?.message).toBe('too_long');
  });
});

describe('optionalTextSchema', () => {
  const schema = optionalTextSchema(5);

  test.each(['', '   ', undefined, null])('turns %p into null', (value) => {
    expect(schema.parse(value)).toBeNull();
  });

  test('trims text', () => {
    expect(schema.parse('  hola ')).toBe('hola');
  });

  test('rejects text above the maximum length', () => {
    const result = schema.safeParse('abcdef');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('too_long');
  });
});

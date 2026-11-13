import { optionalClpTextSchema } from './optional-clp-text-schema';

describe('optionalClpTextSchema', () => {
  it.each(['', '   '])('turns %j into null', (text) => {
    expect(optionalClpTextSchema.parse(text)).toBeNull();
  });

  it('parses an amount like clpTextSchema', () => {
    expect(optionalClpTextSchema.parse('3.000')).toBe(3000);
    expect(optionalClpTextSchema.parse('0')).toBe(0);
  });

  it('reports the stable error code of a bad amount', () => {
    const result = optionalClpTextSchema.safeParse('15,5');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('comma_not_allowed');
  });
});

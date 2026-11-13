import { z } from 'zod';

import { parseRouteParams } from './route-params';

const schema = z.object({ id: z.uuid(), page: z.coerce.number().int().min(1).optional() });
const ID = '00000000-0000-7000-8000-000000000001';

describe('parseRouteParams', () => {
  test('returns the parsed value for valid params', () => {
    expect(parseRouteParams(schema, { id: ID, page: '2' })).toEqual({
      ok: true,
      value: { id: ID, page: 2 },
    });
  });

  test('accepts a missing optional param', () => {
    expect(parseRouteParams(schema, { id: ID })).toEqual({ ok: true, value: { id: ID } });
  });

  test('reports a missing required param', () => {
    expect(parseRouteParams(schema, {})).toEqual({
      ok: false,
      error: { code: 'missing', param: 'id' },
    });
    expect(parseRouteParams(schema, { id: undefined })).toEqual({
      ok: false,
      error: { code: 'missing', param: 'id' },
    });
  });

  test('reports a malformed param', () => {
    expect(parseRouteParams(schema, { id: 'not-an-id' })).toEqual({
      ok: false,
      error: { code: 'invalid', param: 'id' },
    });
    expect(parseRouteParams(schema, { id: ID, page: '0' })).toEqual({
      ok: false,
      error: { code: 'invalid', param: 'page' },
    });
  });

  test('rejects a repeated param (array) instead of picking one', () => {
    expect(parseRouteParams(schema, { id: [ID, ID] })).toEqual({
      ok: false,
      error: { code: 'repeated', param: 'id' },
    });
  });

  test('never throws, even when the schema itself throws', () => {
    const throwing = z.string().transform(() => {
      throw new Error('boom');
    });

    expect(() => parseRouteParams(throwing, {})).not.toThrow();
    expect(parseRouteParams(z.object({ id: throwing }), { id: 'x' }).ok).toBe(false);
  });
});

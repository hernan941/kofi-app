import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  test('configures queries for local data (ADR-009)', () => {
    const options = createQueryClient().getDefaultOptions().queries;

    expect(options).toMatchObject({
      networkMode: 'always',
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    });
  });

  test('configures mutations to run without network', () => {
    expect(createQueryClient().getDefaultOptions().mutations).toMatchObject({
      networkMode: 'always',
    });
  });

  test('returns a new client every time', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});

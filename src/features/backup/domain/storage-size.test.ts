import { formatStorageSize } from './storage-size';

describe('formatStorageSize', () => {
  it.each([
    [0, '1 MB'],
    [1, '1 MB'],
    [1_000_000, '1 MB'],
    [1_000_001, '2 MB'],
    [350_000_000, '350 MB'],
    [349_000_001, '350 MB'],
    [999_000_000, '999 MB'],
    [999_000_001, '1,0 GB'],
    [1_000_000_000, '1,0 GB'],
    [1_150_000_000, '1,2 GB'],
    [1_200_000_000, '1,2 GB'],
    [12_340_000_000, '12,4 GB'],
  ])('shows %d bytes as %s', (bytes, expected) => {
    expect(formatStorageSize(bytes)).toBe(expected);
  });
});

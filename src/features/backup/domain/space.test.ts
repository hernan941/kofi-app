import {
  FREE_SPACE_MARGIN_BYTES,
  estimateArchiveBytes,
  requiredBytesForExport,
  requiredBytesForRestore,
} from './space';

describe('space estimates', () => {
  it('uses a 64 MiB margin', () => {
    expect(FREE_SPACE_MARGIN_BYTES).toBe(67_108_864);
  });

  it('estimates the archive as local headers, data, central records and the end record', () => {
    const bytes = estimateArchiveBytes([
      { path: 'manifest.json', size: 100 },
      { path: 'data.json', size: 1000 },
    ]);

    expect(bytes).toBe(30 + 13 + 100 + (30 + 9 + 1000) + (46 + 13) + (46 + 9) + 22);
  });

  it('estimates an empty archive as just the end record', () => {
    expect(estimateArchiveBytes([])).toBe(22);
  });

  it('adds the margin to an export', () => {
    expect(requiredBytesForExport(1000)).toBe(1000 + FREE_SPACE_MARGIN_BYTES);
  });

  it('adds the safety backup, the photos to copy and the margin for a restore', () => {
    expect(requiredBytesForRestore({ safetyArchiveBytes: 500, photosToCopyBytes: 700 })).toBe(
      1200 + FREE_SPACE_MARGIN_BYTES,
    );
  });
});

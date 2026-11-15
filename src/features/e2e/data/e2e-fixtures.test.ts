import fs from 'node:fs';
import path from 'node:path';

import {
  BACKUP_ZIP_LIMITS,
  backupDataV1Schema,
  checkIntegrity,
  checkPhotoFiles,
  openStoredArchive,
  snapshotToBackupData,
  type BackupManifestV1,
} from '@/features/backup/domain';
import { MemoryFile } from '@/features/backup/testing/in-memory-zip-files';

import { jpegDimensions, paddedJpeg } from '../testing/padded-jpeg';
import {
  generateFixtureArchives,
  type FixtureArchive,
  type GeneratedFixtures,
} from '../testing/fixture-generation';

const FIXTURES_FOLDER = path.join(__dirname, '..', '..', '..', '..', 'e2e', 'fixtures');
const LONG_TIMEOUT_MS = 180_000;

let generated: GeneratedFixtures;

beforeAll(async () => {
  generated = await generateFixtureArchives();
}, LONG_TIMEOUT_MS);

function manifestOf(archive: FixtureArchive): BackupManifestV1 {
  return archive.manifest;
}

describe('fixture snapshots', () => {
  it.each(['basic', 'large'] as const)('%s passes the backup format checks', (name) => {
    const archive = generated[name];
    const data = backupDataV1Schema.safeParse(snapshotToBackupData(archive.snapshot));

    expect(data.success).toBe(true);
    if (!data.success) {
      return;
    }
    expect(checkIntegrity(data.data, manifestOf(archive))).toEqual({ ok: true, value: undefined });
    expect(checkPhotoFiles(data.data, manifestOf(archive))).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('basic has the documented shape', () => {
    const { snapshot } = generated.basic;

    expect(snapshot.products).toHaveLength(5);
    expect(snapshot.products.filter((row) => row.archivedAt !== null)).toHaveLength(1);
    expect(snapshot.productPhotos).toHaveLength(2);
    expect(snapshot.saleRecords.length).toBeGreaterThanOrEqual(18);
    expect(snapshot.saleRecords.length).toBeLessThanOrEqual(24);
    expect(snapshot.noSalesWeeks).toHaveLength(1);
    expect(snapshot.tipViews).toHaveLength(3);
    expect(snapshot.productVersions.some((row) => row.pricingMode === 'negotiable')).toBe(true);
    expect(snapshot.productVersions.some((row) => row.cost !== null)).toBe(true);
  });

  it('large has 200 products, 200 photos of about 250 KB and three years of sales', () => {
    const { snapshot } = generated.large;
    const dates = snapshot.saleRecords.map((row) => row.soldOn).sort();

    expect(snapshot.products).toHaveLength(200);
    expect(snapshot.productPhotos).toHaveLength(200);
    expect(snapshot.productPhotos.every((row) => row.byteSize === 250_000)).toBe(true);
    expect(dates[0]?.slice(0, 4)).toBe('2023');
    expect(dates[dates.length - 1]?.slice(0, 4)).toBe('2026');
    expect(snapshot.noSalesWeeks.length).toBeGreaterThan(5);
  });

  it('never registers a sale in a week marked as "no vendí"', () => {
    for (const name of ['basic', 'large'] as const) {
      const { snapshot } = generated[name];
      const weeks = new Set(snapshot.noSalesWeeks.map((row) => row.weekStart));
      const offending = snapshot.saleRecords.filter((record) => {
        const date = new Date(`${record.soldOn}T00:00:00Z`);
        const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000);
        return weeks.has(monday.toISOString().slice(0, 10) as never);
      });
      expect(offending).toEqual([]);
    }
  });
});

describe('paddedJpeg', () => {
  const base = new Uint8Array(
    fs.readFileSync(path.join(FIXTURES_FOLDER, '..', 'maestro', 'assets', 'gallery-1.jpg')),
  );

  it('reaches the exact size and keeps the image readable', () => {
    const padded = paddedJpeg(base, 250_000, 7);

    expect(padded).toHaveLength(250_000);
    expect(jpegDimensions(padded)).toEqual(jpegDimensions(base));
    expect(padded.subarray(padded.length - base.length + 2)).toEqual(base.subarray(2));
  });

  it('is deterministic by seed and differs between seeds', () => {
    expect(paddedJpeg(base, 100_000, 3)).toEqual(paddedJpeg(base, 100_000, 3));
    expect(
      Buffer.from(paddedJpeg(base, 100_000, 3)).equals(Buffer.from(paddedJpeg(base, 100_000, 4))),
    ).toBe(false);
  });

  it('embeds the three ZIP signatures', () => {
    const text = Buffer.from(paddedJpeg(base, 100_000, 1));

    for (const signature of ['PK\x03\x04', 'PK\x01\x02', 'PK\x07\x08']) {
      expect(text.includes(Buffer.from(signature, 'latin1'))).toBe(true);
    }
  });

  it.each([1, 3, 65_540, 65_541, 65_543])(
    'handles %i extra bytes without a broken tail',
    (extra) => {
      if (extra < 4) {
        expect(() => paddedJpeg(base, base.length + extra, 1)).toThrow(RangeError);
        return;
      }
      expect(paddedJpeg(base, base.length + extra, 1)).toHaveLength(base.length + extra);
    },
  );

  it('refuses a target smaller than the base and a base that is not a JPEG', () => {
    expect(() => paddedJpeg(base, base.length - 1, 1)).toThrow(RangeError);
    expect(() => paddedJpeg(new Uint8Array([1, 2, 3]), 100, 1)).toThrow(RangeError);
  });
});

describe('generated archives', () => {
  it(
    'are byte for byte identical across two generations',
    async () => {
      const again = await generateFixtureArchives();

      expect(Buffer.from(again.basic.bytes).equals(Buffer.from(generated.basic.bytes))).toBe(true);
      expect(Buffer.from(again.large.bytes).equals(Buffer.from(generated.large.bytes))).toBe(true);
    },
    LONG_TIMEOUT_MS,
  );

  it('carry ZIP signatures inside valid JPEG photos', () => {
    const photo = generated.basic.photoBytes[0];

    expect(photo?.[0]).toBe(0xff);
    expect(photo?.[1]).toBe(0xd8);
    expect(photo?.[photo.length - 2]).toBe(0xff);
    expect(photo?.[photo.length - 1]).toBe(0xd9);
    expect(
      Buffer.from(photo ?? new Uint8Array()).includes(Buffer.from('PK\x03\x04', 'latin1')),
    ).toBe(true);
  });

  it.each(['basic', 'large'] as const)('are accepted by the ZIP reader (%s)', async (name) => {
    const archive = generated[name];
    const file = new MemoryFile(archive.bytes);

    const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    expect(opened.value.entries.size).toBe(archive.snapshot.productPhotos.length + 2);
  });
});

describe('e2e/fixtures on disk', () => {
  it('basic.zip in the repository equals what the generator produces', () => {
    if (process.env.E2E_FIXTURES_WRITE === '1') {
      fs.mkdirSync(FIXTURES_FOLDER, { recursive: true });
      fs.writeFileSync(path.join(FIXTURES_FOLDER, 'basic.zip'), generated.basic.bytes);
      fs.writeFileSync(path.join(FIXTURES_FOLDER, 'large.zip'), generated.large.bytes);
    }

    const stored = fs.readFileSync(path.join(FIXTURES_FOLDER, 'basic.zip'));

    expect(stored.equals(Buffer.from(generated.basic.bytes))).toBe(true);
  });
});

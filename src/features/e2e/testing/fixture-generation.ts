import fs from 'node:fs';
import path from 'node:path';

import {
  BACKUP_ZIP_LIMITS,
  backupManifestV1Schema,
  decodeUtf8Strict,
  openStoredArchive,
  readVerifiedEntry,
  type BackupManifestV1,
  type DatabaseSnapshot,
} from '@/features/backup/domain';
import { buildBackupArchive } from '@/features/backup/testing/backup-archive-builder';
import { MemoryFile } from '@/features/backup/testing/in-memory-zip-files';

import {
  FIXTURE_NOW,
  createBasicFixture,
  createLargeFixture,
  type FixtureData,
} from './fixture-factories';

const GALLERY_FOLDER = path.join(__dirname, '..', '..', '..', '..', 'e2e', 'maestro', 'assets');
const GALLERY_FILES = ['gallery-1.jpg', 'gallery-2.jpg', 'gallery-3.jpg'] as const;

/** Un fixture ya empaquetado, con lo necesario para verificarlo. */
export interface FixtureArchive {
  readonly bytes: Uint8Array;
  readonly snapshot: DatabaseSnapshot;
  readonly manifest: BackupManifestV1;
  readonly photoBytes: readonly Uint8Array[];
}

/** Los dos fixtures de E2E. */
export interface GeneratedFixtures {
  readonly basic: FixtureArchive;
  readonly large: FixtureArchive;
}

function loadGalleryJpegs(): Uint8Array[] {
  return GALLERY_FILES.map(
    (name) => new Uint8Array(fs.readFileSync(path.join(GALLERY_FOLDER, name))),
  );
}

async function readManifest(bytes: Uint8Array): Promise<BackupManifestV1> {
  const file = new MemoryFile(bytes);
  const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
  const entry = opened.ok ? opened.value.entries.get('manifest.json') : undefined;
  if (entry === undefined) {
    throw new Error('The generated archive has no manifest.');
  }
  const manifestBytes = await readVerifiedEntry(file, entry);
  const text = manifestBytes.ok ? decodeUtf8Strict(manifestBytes.value) : null;
  if (!text?.ok) {
    throw new Error('The generated manifest is not readable.');
  }
  return backupManifestV1Schema.parse(JSON.parse(text.value));
}

async function pack(data: FixtureData): Promise<FixtureArchive> {
  const bytes = await buildBackupArchive({
    snapshot: data.snapshot,
    photos: data.photos,
    now: FIXTURE_NOW,
    appVersion: '1.0.0',
  });
  return {
    bytes,
    snapshot: data.snapshot,
    manifest: await readManifest(bytes),
    photoBytes: [...data.photos.values()],
  };
}

/**
 * Genera `basic` y `large` con el escritor puro de F8.3 y las fábricas deterministas: dos
 * llamadas dan exactamente los mismos bytes. Lee las fotos base de `e2e/maestro/assets/`.
 */
export async function generateFixtureArchives(): Promise<GeneratedFixtures> {
  const gallery = loadGalleryJpegs();
  return {
    basic: await pack(createBasicFixture(gallery)),
    large: await pack(createLargeFixture(gallery)),
  };
}

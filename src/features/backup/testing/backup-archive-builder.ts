import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, type EpochMs, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import type { DatabaseSnapshot } from '../domain/snapshot';
import { collectBackupContents } from '../use-cases/collect-backup-contents';
import { writeBackupContents } from '../use-cases/write-backup-contents';
import { InMemoryArchiveIo } from './in-memory-archive-io';

const DEFAULT_NOW = epochMsSchema.parse(Date.parse('2026-11-01T12:00:00Z'));
const TARGET = 'file:///builder/backup.zip';

/** Datos para armar un respaldo ZIP de test con el camino real de exportación. */
export interface BackupArchiveInput {
  readonly snapshot: DatabaseSnapshot;
  /** Contenido de cada foto activa; las que no estén aquí salen borradas del respaldo. */
  readonly photos?: ReadonlyMap<ProductPhotoId, Uint8Array>;
  readonly now?: EpochMs;
  readonly appVersion?: string;
}

/**
 * Arma los bytes de un respaldo ZIP con `collectBackupContents` y `writeBackupContents`, sobre
 * dobles en memoria. Sirve para los tests de restauración y para generar los fixtures de E2E.
 */
export async function buildBackupArchive(input: BackupArchiveInput): Promise<Uint8Array> {
  const now = input.now ?? DEFAULT_NOW;
  const io = new InMemoryArchiveIo();
  const storage = new InMemoryPhotoStorage();
  for (const [id, bytes] of input.photos ?? []) {
    storage.addFile(id, now);
    io.put(storage.uriFor(id), bytes);
  }
  const contents = await collectBackupContents(
    {
      store: { readSnapshot: () => Promise.resolve(input.snapshot) },
      photos: storage,
      archiveIo: io,
      clock: new FakeClock(now),
      logger: new RecordingLogger(),
      appVersion: input.appVersion ?? '1.0.0',
    },
    () => undefined,
  );
  if (!contents.ok) {
    throw new Error(`Cannot build the test archive: ${contents.error.code}`);
  }
  await writeBackupContents(contents.value, TARGET, io, () => undefined);
  const bytes = io.files.get(TARGET);
  if (bytes === undefined) {
    throw new Error('The test archive was not written.');
  }
  return bytes;
}

import { useEffect, useState } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import {
  BACKUP_ZIP_LIMITS,
  confirmRestore,
  prepareRestore,
  type ArchiveIo,
  type RestoreDeps,
} from '@/features/backup';

import type { E2eFixtureName } from '../domain/fixture-names';

/** Estado de la carga de un fixture. */
export type SeedState =
  | { readonly status: 'loading' }
  | { readonly status: 'done' }
  | { readonly status: 'failed'; readonly reason: string };

function seedCopyUri(assetUri: string, name: E2eFixtureName): string {
  return assetUri.replace(/[^/]*$/, `cuantovendi-seed-${name}.zip`);
}

async function copyToSeedFile(io: ArchiveIo, fromUri: string, toUri: string): Promise<void> {
  const source = await io.openForRead(fromUri);
  try {
    await io.copyRange(source, 0, source.size, toUri);
  } finally {
    source.close();
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function seed(
  deps: RestoreDeps,
  name: E2eFixtureName,
  materialize: (name: E2eFixtureName) => Promise<string>,
): Promise<SeedState> {
  const assetUri = await materialize(name);
  const seedUri = seedCopyUri(assetUri, name);
  await copyToSeedFile(deps.archiveIo, assetUri, seedUri);
  const plan = await prepareRestore(deps, seedUri);
  if (!plan.ok) {
    deps.backupFiles.discardPicked(seedUri);
    return { status: 'failed', reason: plan.error.code };
  }
  const restored = await confirmRestore(deps, plan.value, () => undefined);
  return restored.ok ? { status: 'done' } : { status: 'failed', reason: restored.error.code };
}

/**
 * Restaura un fixture de E2E (ADR-013) por el camino real de restauración: lo materializa, lo
 * copia a un archivo propio de la caché (la restauración borra su fuente) y ejecuta
 * `prepareRestore` y `confirmRestore`. Solo se carga en el build E2E.
 */
export function useSeedFixture(
  name: E2eFixtureName,
  materialize: (name: E2eFixtureName) => Promise<string>,
): SeedState {
  const dependencies = useDependencies();
  const [state, setState] = useState<SeedState>({ status: 'loading' });
  const { archiveIo, backupFiles, backupStore, photos, fileLock, clock, logger, appVersion } =
    dependencies;
  useEffect(() => {
    let active = true;
    const deps: RestoreDeps = {
      archiveIo,
      backupFiles,
      store: backupStore,
      photos,
      fileLock,
      clock,
      logger,
      appVersion,
      limits: BACKUP_ZIP_LIMITS,
      yieldToUi,
    };
    seed(deps, name, materialize)
      .then((result) => {
        if (active) {
          setState(result);
        }
      })
      .catch((error: unknown) => {
        logger.error('e2e_seed_failed', error);
        if (active) {
          setState({
            status: 'failed',
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [
    name,
    materialize,
    archiveIo,
    backupFiles,
    backupStore,
    photos,
    fileLock,
    clock,
    logger,
    appVersion,
  ]);
  return state;
}

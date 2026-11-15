import { screen, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import type { DatabaseSnapshot } from '@/features/backup/domain';
import { buildBackupArchive } from '@/features/backup/testing/backup-archive-builder';
import { FakeBackupFiles } from '@/features/backup/testing/fake-backup-files';
import { InMemoryArchiveIo } from '@/features/backup/testing/in-memory-archive-io';
import { richSnapshot } from '@/features/backup/testing/snapshot-fixtures';
import { epochMsSchema } from '@/shared/domain';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';

import { SeedScreen } from './seed-screen';

jest.mock('../adapters/expo-fixture-assets', () => ({ materializeFixture: jest.fn() }));

const ASSET_URI = 'file:///data/cache/ExpoAsset/abc123.zip';

async function setUp(options: { archive?: Uint8Array | null } = {}) {
  const dependencies = createTestDependencies();
  const io = new InMemoryArchiveIo();
  const backupFiles = new FakeBackupFiles();
  const replaceAll = jest.fn((_snapshot: DatabaseSnapshot) => Promise.resolve());
  const snapshot = richSnapshot();
  const photo = snapshot.productPhotos.find((row) => row.deletedAt === null);
  const archive =
    options.archive === undefined
      ? await buildBackupArchive({
          snapshot,
          photos: new Map(photo === undefined ? [] : [[photo.id, new Uint8Array([1, 2, 3, 4])]]),
        })
      : options.archive;
  if (archive !== null) {
    io.put(ASSET_URI, archive);
  }
  const photos = new InMemoryPhotoStorage();
  const copyRange = io.copyRange.bind(io);
  io.copyRange = async (source, offset, length, target) => {
    await copyRange(source, offset, length, target);
    if (photo !== undefined && target === photos.partialUriFor(photo.id)) {
      photos.addPartial(photo.id, epochMsSchema.parse(1));
    }
  };
  const materialize = jest.fn((): Promise<string> => Promise.resolve(ASSET_URI));
  const view = await renderWithProviders(<SeedScreen fixture="basic" materialize={materialize} />, {
    dependencies: {
      ...dependencies,
      archiveIo: io,
      backupFiles,
      photos,
      backupStore: { ...dependencies.backupStore, replaceAll },
    },
  });
  return { view, io, backupFiles, replaceAll, materialize, snapshot };
}

describe('SeedScreen', () => {
  it('shows the loading text, restores the fixture and then confirms it by name', async () => {
    const { replaceAll, materialize, snapshot } = await setUp();

    expect(await screen.findByText('Datos de prueba cargados: basic')).toBeOnTheScreen();
    expect(materialize).toHaveBeenCalledWith('basic');
    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(replaceAll.mock.calls[0]?.[0]).toMatchObject({
      products: expect.arrayContaining([
        expect.objectContaining({ id: snapshot.products[0]?.id }),
      ]) as never,
    });
  });

  it('restores from a private copy in the same cache folder and discards it', async () => {
    const { io, backupFiles } = await setUp();

    await screen.findByText('Datos de prueba cargados: basic');

    const copy = io.created.find((uri) => uri.includes('seed-basic'));
    expect(copy).toBe('file:///data/cache/ExpoAsset/cuantovendi-seed-basic.zip');
    expect(backupFiles.discarded).toEqual([copy]);
    expect(io.allClosed()).toBe(true);
  });

  it('reports the failure by its code when the fixture is not a valid backup', async () => {
    const { replaceAll } = await setUp({ archive: new Uint8Array([1, 2, 3, 4, 5, 6]) });

    expect(
      await screen.findByText('No se pudieron cargar los datos de prueba: not_a_backup'),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(replaceAll).not.toHaveBeenCalled();
    });
  });

  it('reports an unexpected failure too', async () => {
    const dependencies = createTestDependencies();
    await renderWithProviders(
      <SeedScreen fixture="large" materialize={() => Promise.reject(new Error('boom'))} />,
      { dependencies },
    );

    expect(
      await screen.findByText('No se pudieron cargar los datos de prueba: boom'),
    ).toBeOnTheScreen();
  });
});

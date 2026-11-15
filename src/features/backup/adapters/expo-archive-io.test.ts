import { createHash } from 'node:crypto';

import { openStoredArchive, readVerifiedEntry, writeStoredArchive } from '../domain';
import { BACKUP_ZIP_LIMITS } from '../domain/zip/format';
import { fakeCryptoCalls, fakeFileSystem } from '../testing/fake-expo-file-system';
import { createExpoArchiveIo } from './expo-archive-io';
import type * as FakeFileSystemModule from '../testing/fake-expo-file-system';

jest.mock('expo-file-system', () =>
  jest
    .requireActual<typeof FakeFileSystemModule>('../testing/fake-expo-file-system')
    .createFakeExpoFileSystemModule(),
);
jest.mock('expo-crypto', () =>
  jest
    .requireActual<typeof FakeFileSystemModule>('../testing/fake-expo-file-system')
    .createFakeExpoCryptoModule(),
);

const SOURCE = 'file:///data/cache/backups/source.zip';
const PHOTO_PATH = 'photos/0190aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee.jpg';
const TARGET = 'file:///data/doc/photos/target.jpg.part';

function sequence(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 7 + 3) % 256);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('createExpoArchiveIo', () => {
  const io = createExpoArchiveIo();

  beforeEach(() => {
    fakeFileSystem.reset();
    fakeCryptoCalls.length = 0;
  });

  describe('openForRead', () => {
    it('reports the size and reads the requested range by offset', async () => {
      fakeFileSystem.put(SOURCE, sequence(100));

      const file = await io.openForRead(SOURCE);

      expect(file.size).toBe(100);
      expect(await file.read(10, 5)).toEqual(sequence(100).slice(10, 15));
      expect(await file.read(0, 3)).toEqual(sequence(100).slice(0, 3));
      file.close();
    });

    it('rejects a read that returns fewer bytes than requested', async () => {
      fakeFileSystem.put(SOURCE, sequence(10));
      const file = await io.openForRead(SOURCE);

      await expect(file.read(8, 5)).rejects.toThrow();
      file.close();
    });

    it('repeats a short read until the requested length is complete', async () => {
      fakeFileSystem.put(SOURCE, sequence(100));
      fakeFileSystem.maxReadBytes = 30;
      const file = await io.openForRead(SOURCE);

      expect(await file.read(5, 70)).toEqual(sequence(100).slice(5, 75));
      expect(fakeFileSystem.readCalls).toBe(3);
      file.close();
    });

    it('fails only at the end of the file, even after some short reads', async () => {
      fakeFileSystem.put(SOURCE, sequence(40));
      fakeFileSystem.maxReadBytes = 10;
      const file = await io.openForRead(SOURCE);

      await expect(file.read(25, 30)).rejects.toThrow(RangeError);
      file.close();
    });

    it('does not mix two concurrent reads at different offsets', async () => {
      fakeFileSystem.put(SOURCE, sequence(100));
      const file = await io.openForRead(SOURCE);

      const [first, second] = await Promise.all([file.read(50, 10), file.read(0, 10)]);

      expect(first).toEqual(sequence(100).slice(50, 60));
      expect(second).toEqual(sequence(100).slice(0, 10));
      file.close();
    });

    it('keeps serving reads after one fails', async () => {
      fakeFileSystem.put(SOURCE, sequence(100));
      fakeFileSystem.readFailureAtCall = 1;
      const file = await io.openForRead(SOURCE);

      await expect(file.read(0, 4)).rejects.toThrow('read failed');
      expect(await file.read(4, 4)).toEqual(sequence(100).slice(4, 8));
      file.close();
    });

    it('releases the handle on close and tolerates closing twice', async () => {
      fakeFileSystem.put(SOURCE, sequence(10));
      const file = await io.openForRead(SOURCE);

      file.close();
      file.close();

      expect(fakeFileSystem.openHandles).toBe(0);
    });
  });

  describe('createForWrite', () => {
    it('creates the folders and writes the chunks in order', async () => {
      const writer = await io.createForWrite(TARGET);

      await Promise.all([
        writer.write(Uint8Array.of(1, 2, 3)),
        writer.write(Uint8Array.of(4, 5)),
        writer.write(Uint8Array.of(6)),
      ]);
      writer.close();

      expect(fakeFileSystem.read(TARGET)).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
      expect(writer.position).toBe(6);
      expect(fakeFileSystem.directories.has('file:///data/doc/photos/')).toBe(true);
      expect(fakeFileSystem.openHandles).toBe(0);
    });

    it('truncates a file that already exists', async () => {
      fakeFileSystem.put(TARGET, sequence(50));

      const writer = await io.createForWrite(TARGET);
      await writer.write(Uint8Array.of(9));
      writer.close();

      expect(fakeFileSystem.read(TARGET)).toEqual(Uint8Array.of(9));
    });

    it('reads back byte for byte what the pure writer produced', async () => {
      const photo = sequence(3000);
      const archiveUri = 'file:///data/cache/backups/roundtrip.zip';
      const writer = await io.createForWrite(archiveUri);
      await writeStoredArchive(writer, [
        {
          path: PHOTO_PATH,
          size: photo.length,
          readRange: (offset, length) => Promise.resolve(photo.slice(offset, offset + length)),
        },
      ]);
      writer.close();

      const file = await io.openForRead(archiveUri);
      const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);

      expect(opened.ok).toBe(true);
      if (!opened.ok) {
        return;
      }
      const entry = opened.value.entries.get(PHOTO_PATH);
      if (entry === undefined) {
        throw new Error('The photo entry is missing.');
      }
      const read = await readVerifiedEntry(file, entry);
      expect(read).toEqual({ ok: true, value: photo });
      file.close();
    });

    it('closes the handle when a write fails', async () => {
      fakeFileSystem.writeFailureAtCall = 2;
      const writer = await io.createForWrite(TARGET);
      await writer.write(Uint8Array.of(1));

      await expect(writer.write(Uint8Array.of(2))).rejects.toThrow('write failed');
      writer.close();

      expect(fakeFileSystem.openHandles).toBe(0);
    });
  });

  describe('copyRange', () => {
    it('copies exactly the requested range to the given target in blocks of 1 MiB', async () => {
      const data = sequence(3 * 1_048_576);
      fakeFileSystem.put(SOURCE, data);
      const source = await io.openForRead(SOURCE);
      fakeFileSystem.readCalls = 0;

      await io.copyRange(source, 100, 2_500_000, TARGET);

      expect(fakeFileSystem.read(TARGET)).toEqual(data.slice(100, 100 + 2_500_000));
      expect(fakeFileSystem.readCalls).toBe(3);
      expect(fakeFileSystem.files.size).toBe(2);
      source.close();
    });

    it('copies an empty range as an empty file', async () => {
      fakeFileSystem.put(SOURCE, sequence(10));
      const source = await io.openForRead(SOURCE);

      await io.copyRange(source, 4, 0, TARGET);

      expect(fakeFileSystem.read(TARGET)).toEqual(new Uint8Array(0));
      source.close();
    });

    it('closes the target handle when the read fails and leaves the source open', async () => {
      fakeFileSystem.put(SOURCE, sequence(2_000_000));
      const source = await io.openForRead(SOURCE);
      fakeFileSystem.readCalls = 0;
      fakeFileSystem.readFailureAtCall = 2;

      await expect(io.copyRange(source, 0, 2_000_000, TARGET)).rejects.toThrow('read failed');

      expect(fakeFileSystem.openHandles).toBe(1);
      source.close();
      expect(fakeFileSystem.openHandles).toBe(0);
    });
  });

  describe('hashes and space', () => {
    it('hashes a file with the native digest in lower case', async () => {
      const bytes = sequence(500);
      fakeFileSystem.put(SOURCE, bytes);

      await expect(io.sha256OfFile(SOURCE)).resolves.toBe(sha256Hex(bytes));
    });

    it('hashes bytes with expo-crypto as lower case hex', async () => {
      const bytes = sequence(64);

      await expect(io.sha256OfBytes(bytes)).resolves.toBe(sha256Hex(bytes));
      expect(fakeCryptoCalls).toEqual([{ algorithm: 'SHA-256', length: 64 }]);
    });

    it('reads the free space from the file system', () => {
      fakeFileSystem.availableDiskSpace = 1234;

      expect(io.availableDiskSpace()).toBe(1234);
    });
  });
});

import { epochMsSchema } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { fakeFileSystem } from '../testing/fake-expo-file-system';
import { createExpoBackupFiles } from './expo-backup-files';
import type * as FakeFileSystemModule from '../testing/fake-expo-file-system';

jest.mock('expo-file-system', () =>
  jest
    .requireActual<typeof FakeFileSystemModule>('../testing/fake-expo-file-system')
    .createFakeExpoFileSystemModule(),
);

const CACHE = 'file:///data/cache';
const SAFETY = 'file:///data/doc/safety';
const MINUTE = 60_000;
const NOW = epochMsSchema.parse(10_000_000);
const at = (value: number) => epochMsSchema.parse(value);

describe('createExpoBackupFiles', () => {
  let logger: RecordingLogger;
  let files: ReturnType<typeof createExpoBackupFiles>;

  beforeEach(() => {
    fakeFileSystem.reset();
    logger = new RecordingLogger();
    files = createExpoBackupFiles(logger);
  });

  describe('exportTarget', () => {
    it('returns the path under cache/backups and creates the folder', () => {
      const uri = files.exportTarget('cuantovendi-respaldo-2026-11-13.zip');

      expect(uri).toBe(`${CACHE}/backups/cuantovendi-respaldo-2026-11-13.zip`);
      expect(fakeFileSystem.directories.has(`${CACHE}/backups/`)).toBe(true);
    });

    it('deletes a previous file with the same name', () => {
      fakeFileSystem.put(`${CACHE}/backups/ventas.csv`, 'old');

      const uri = files.exportTarget('ventas.csv');

      expect(fakeFileSystem.read(uri)).toBeUndefined();
    });

    it.each(['../ventas.csv', 'otro.zip', 'cuantovendi-respaldo-2026-11-13.zip.part', ''])(
      'rejects the name %j',
      (name) => {
        expect(() => files.exportTarget(name)).toThrow();
      },
    );
  });

  describe('safety backups', () => {
    it('builds the part and final paths from the instant', () => {
      const target = files.safetyTarget(at(1_800_000_000_123));

      expect(target).toEqual({
        partUri: `${SAFETY}/cuantovendi-seguridad-1800000000123.zip.part`,
        finalUri: `${SAFETY}/cuantovendi-seguridad-1800000000123.zip`,
      });
      expect(fakeFileSystem.directories.has(`${SAFETY}/`)).toBe(true);
    });

    it('promotes the part file to the final name', async () => {
      const target = files.safetyTarget(at(5));
      fakeFileSystem.put(target.partUri, 'zip');

      await files.promoteSafety(target);

      expect(fakeFileSystem.read(target.partUri)).toBeUndefined();
      expect(fakeFileSystem.read(target.finalUri)).toEqual(new TextEncoder().encode('zip'));
    });

    it('refuses to promote paths it did not build', async () => {
      fakeFileSystem.put(`${CACHE}/evil.part`, 'x');

      await expect(
        files.promoteSafety({ partUri: `${CACHE}/evil.part`, finalUri: `${CACHE}/evil.zip` }),
      ).rejects.toThrow();
      expect(fakeFileSystem.read(`${CACHE}/evil.zip`)).toBeUndefined();
    });

    it('keeps only the indicated backup when pruning', async () => {
      const keep = `${SAFETY}/cuantovendi-seguridad-0000000000009.zip`;
      fakeFileSystem.put(keep, 'new');
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000001.zip`, 'old');
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000002.zip.part`, 'part');

      await files.pruneSafety(keep);

      expect(fakeFileSystem.namesIn(SAFETY)).toEqual(['cuantovendi-seguridad-0000000000009.zip']);
    });

    it('reports the newest safety backup or null', () => {
      expect(files.latestSafety()).toBeNull();
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000001.zip`, 'a');
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000007.zip`, 'b');
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000009.zip.part`, 'c');
      fakeFileSystem.put(`${SAFETY}/notas.txt`, 'd');

      expect(files.latestSafety()).toEqual({
        uri: `${SAFETY}/cuantovendi-seguridad-0000000000007.zip`,
        createdAt: 7,
      });
    });
  });

  describe('emergencyDirectory', () => {
    it('creates and returns cache/emergency', () => {
      const uri = files.emergencyDirectory();

      expect(uri).toBe(`${CACHE}/emergency/`);
      expect(fakeFileSystem.directories.has(`${CACHE}/emergency/`)).toBe(true);
    });
  });

  describe('clearEmergencyDirectory', () => {
    it('deletes every file of cache/emergency and nothing else', () => {
      fakeFileSystem.put(`${CACHE}/emergency/cuantovendi-1.db`, 'a');
      fakeFileSystem.put(`${CACHE}/emergency/cuantovendi-emergencia-2026-11-14.zip`, 'b');
      fakeFileSystem.put(`${CACHE}/backups/keep.zip`, 'c');

      files.clearEmergencyDirectory();

      expect(fakeFileSystem.namesIn(`${CACHE}/emergency`)).toEqual([]);
      expect(fakeFileSystem.namesIn(`${CACHE}/backups`)).toEqual(['keep.zip']);
    });

    it('does nothing when the folder does not exist', () => {
      expect(() => {
        files.clearEmergencyDirectory();
      }).not.toThrow();
    });
  });

  describe('restoreCopyTarget', () => {
    it('returns a fixed path under cache/DocumentPicker, creates the folder and clears a previous copy', () => {
      fakeFileSystem.put(`${CACHE}/DocumentPicker/cuantovendi-copia-de-seguridad.zip`, 'old');

      const uri = files.restoreCopyTarget();

      expect(uri).toBe(`${CACHE}/DocumentPicker/cuantovendi-copia-de-seguridad.zip`);
      expect(fakeFileSystem.directories.has(`${CACHE}/DocumentPicker/`)).toBe(true);
      expect(fakeFileSystem.read(uri)).toBeUndefined();
    });
  });

  describe('discardPicked', () => {
    it('deletes a copy made by the picker inside the cache', () => {
      const uri = `${CACHE}/DocumentPicker/respaldo.zip`;
      fakeFileSystem.put(uri, 'x');

      files.discardPicked(uri);

      expect(fakeFileSystem.read(uri)).toBeUndefined();
    });

    it('does not touch a file outside the cache and logs it', () => {
      const uri = 'file:///data/doc/photos/a.jpg';
      fakeFileSystem.put(uri, 'x');

      files.discardPicked(uri);

      expect(fakeFileSystem.read(uri)).toBeDefined();
      expect(logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
        'backup_picked_outside_cache',
      ]);
    });

    it('logs only that the file is outside the cache, never its URI', () => {
      files.discardPicked('file:///data/doc/photos/cliente-juan-perez.jpg');

      expect(logger.entriesAt('warn')[0]?.context).toEqual({
        reason: 'outside_cache',
        scheme: 'file',
      });
    });

    it('logs the scheme of a URI that is not a file', () => {
      files.discardPicked('content://com.example.provider/docs/cliente-juan.zip');

      expect(logger.entriesAt('warn')[0]?.context).toEqual({
        reason: 'outside_cache',
        scheme: 'content',
      });
    });

    it('logs and keeps going when the deletion fails', () => {
      const uri = `${CACHE}/DocumentPicker/respaldo.zip`;
      fakeFileSystem.put(uri, 'x');
      fakeFileSystem.deleteFailures.add(uri);

      expect(() => {
        files.discardPicked(uri);
      }).not.toThrow();
      expect(logger.entriesAt('warn')).toHaveLength(1);
    });
  });

  describe('sweep', () => {
    it('deletes only the temporaries older than the minimum age', async () => {
      const old = NOW - 20 * MINUTE;
      fakeFileSystem.put(`${CACHE}/backups/old.zip`, 'a', old);
      fakeFileSystem.put(`${CACHE}/backups/exact.zip`, 'a', NOW - 15 * MINUTE);
      fakeFileSystem.put(`${CACHE}/backups/fresh.zip`, 'a', NOW - MINUTE);
      fakeFileSystem.put(`${CACHE}/emergency/old.db`, 'a', old);
      fakeFileSystem.put(`${CACHE}/DocumentPicker/old.zip`, 'a', old);
      fakeFileSystem.put(`${CACHE}/ImagePicker/old.jpg`, 'a', old);

      const result = await files.sweep(NOW, 15 * MINUTE);

      expect(result).toEqual({ removed: 3 });
      expect(fakeFileSystem.namesIn(`${CACHE}/backups`).sort()).toEqual(['exact.zip', 'fresh.zip']);
      expect(fakeFileSystem.namesIn(`${CACHE}/ImagePicker`)).toEqual(['old.jpg']);
    });

    it('deletes old part files of safety and every safety zip except the newest', async () => {
      const old = NOW - 20 * MINUTE;
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000001.zip`, 'a', old);
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000002.zip`, 'b', NOW);
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000003.zip.part`, 'c', old);
      fakeFileSystem.put(`${SAFETY}/cuantovendi-seguridad-0000000000004.zip.part`, 'd', NOW);

      const result = await files.sweep(NOW, 15 * MINUTE);

      expect(result).toEqual({ removed: 2 });
      expect(fakeFileSystem.namesIn(SAFETY).sort()).toEqual([
        'cuantovendi-seguridad-0000000000002.zip',
        'cuantovendi-seguridad-0000000000004.zip.part',
      ]);
    });

    it('does nothing when the folders do not exist and keeps going after a failed deletion', async () => {
      await expect(files.sweep(NOW, 15 * MINUTE)).resolves.toEqual({ removed: 0 });

      const stuck = `${CACHE}/backups/stuck.zip`;
      fakeFileSystem.put(stuck, 'a', 0);
      fakeFileSystem.put(`${CACHE}/backups/other.zip`, 'a', 0);
      fakeFileSystem.deleteFailures.add(stuck);

      await expect(files.sweep(NOW, 15 * MINUTE)).resolves.toEqual({ removed: 1 });
      expect(logger.entriesAt('warn').map((entry) => entry.event)).toContain(
        'backup_sweep_delete_failed',
      );
    });
  });
});

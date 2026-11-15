import { Directory, File, Paths } from 'expo-file-system';

import { isCacheUri, uriScheme } from '@/core/files/cache-uri';
import type { EpochMs } from '@/shared/domain';
import type { Logger } from '@/shared/lib/logger';

import { isExportFileName, parseSafetyFileName, safetyFileName } from '../domain/file-names';
import type { BackupFiles, SafetyBackupInfo, SafetyTarget } from '../domain/ports';

const BACKUPS_FOLDER = 'backups';
const EMERGENCY_FOLDER = 'emergency';
const PICKER_FOLDER = 'DocumentPicker';
const SAFETY_FOLDER = 'safety';
const PART_SUFFIX = '.part';
const RESTORE_COPY_FILE_NAME = 'cuantovendi-copia-de-seguridad.zip';

function cacheFolder(name: string): Directory {
  return new Directory(Paths.cache, name);
}

function safetyFolder(): Directory {
  return new Directory(Paths.document, SAFETY_FOLDER);
}

function ensure(directory: Directory): Directory {
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function filesIn(directory: Directory): File[] {
  return directory.exists ? directory.list().filter((entry) => entry instanceof File) : [];
}

function safetyUrisFor(createdAt: EpochMs): SafetyTarget {
  const finalUri = new File(safetyFolder(), safetyFileName(createdAt)).uri;
  return { partUri: `${finalUri}${PART_SUFFIX}`, finalUri };
}

function isOwnSafetyTarget(target: SafetyTarget): boolean {
  const name = target.finalUri.split('/').pop() ?? '';
  const createdAt = parseSafetyFileName(name);
  if (createdAt === null) {
    return false;
  }
  const expected = safetyUrisFor(createdAt);
  return expected.finalUri === target.finalUri && expected.partUri === target.partUri;
}

/**
 * `BackupFiles` sobre `expo-file-system` (ADR-012). Las rutas salen de nombres que genera
 * `domain/file-names.ts` y se validan por patrón; solo se borra dentro de `Paths.cache/backups/`,
 * `emergency/`, `DocumentPicker/` y `Paths.document/safety/`.
 */
export function createExpoBackupFiles(logger: Logger): BackupFiles {
  function deleteQuietly(file: File): boolean {
    try {
      file.delete();
      return true;
    } catch (error) {
      logger.warn('backup_sweep_delete_failed', { error: String(error) });
      return false;
    }
  }

  function sweepFolder(directory: Directory, now: EpochMs, minAgeMs: number): number {
    return filesIn(directory).filter(
      (file) =>
        file.lastModified !== null && now - file.lastModified > minAgeMs && deleteQuietly(file),
    ).length;
  }

  function sweepSafety(now: EpochMs, minAgeMs: number): number {
    const files = filesIn(safetyFolder());
    const zips = files
      .filter((file) => parseSafetyFileName(file.name) !== null)
      .sort((a, b) => (parseSafetyFileName(b.name) ?? 0) - (parseSafetyFileName(a.name) ?? 0));
    const parts = files.filter((file) => file.name.endsWith(PART_SUFFIX));
    const stale = parts.filter(
      (file) => file.lastModified !== null && now - file.lastModified > minAgeMs,
    );
    return [...zips.slice(1), ...stale].filter(deleteQuietly).length;
  }

  return {
    exportTarget: (fileName) => {
      if (!isExportFileName(fileName)) {
        throw new Error('The export file name is not allowed.');
      }
      const file = new File(ensure(cacheFolder(BACKUPS_FOLDER)), fileName);
      if (file.exists) {
        file.delete();
      }
      return file.uri;
    },
    safetyTarget: (createdAt) => {
      ensure(safetyFolder());
      return safetyUrisFor(createdAt);
    },
    promoteSafety: (target) =>
      Promise.resolve().then(() => {
        if (!isOwnSafetyTarget(target)) {
          throw new Error('The safety backup target is not allowed.');
        }
        const destination = new File(target.finalUri);
        if (destination.exists) {
          throw new Error('The safety backup already exists.');
        }
        return new File(target.partUri).move(destination);
      }),
    pruneSafety: (keepUri) =>
      Promise.resolve().then(() => {
        filesIn(safetyFolder())
          .filter((file) => file.uri !== keepUri)
          .forEach(deleteQuietly);
      }),
    latestSafety: (): SafetyBackupInfo | null => {
      let latest: SafetyBackupInfo | null = null;
      for (const file of filesIn(safetyFolder())) {
        const createdAt = parseSafetyFileName(file.name);
        if (createdAt !== null && (latest === null || createdAt > latest.createdAt)) {
          latest = { uri: file.uri, createdAt };
        }
      }
      return latest;
    },
    restoreCopyTarget: () => {
      const file = new File(ensure(cacheFolder(PICKER_FOLDER)), RESTORE_COPY_FILE_NAME);
      if (file.exists) {
        file.delete();
      }
      return file.uri;
    },
    emergencyDirectory: () => ensure(cacheFolder(EMERGENCY_FOLDER)).uri,
    clearEmergencyDirectory: () => {
      filesIn(cacheFolder(EMERGENCY_FOLDER)).forEach(deleteQuietly);
    },
    discardPicked: (uri) => {
      if (!isCacheUri(uri)) {
        logger.warn('backup_picked_outside_cache', {
          reason: 'outside_cache',
          scheme: uriScheme(uri),
        });
        return;
      }
      const file = new File(uri);
      if (file.exists) {
        deleteQuietly(file);
      }
    },
    sweep: (now, minAgeMs) =>
      Promise.resolve().then(() => ({
        removed:
          [BACKUPS_FOLDER, EMERGENCY_FOLDER, PICKER_FOLDER]
            .map((name) => sweepFolder(cacheFolder(name), now, minAgeMs))
            .reduce((total, count) => total + count, 0) + sweepSafety(now, minAgeMs),
      })),
  };
}

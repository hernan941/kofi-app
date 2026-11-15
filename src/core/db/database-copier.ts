import { File } from 'expo-file-system';
import { backupDatabaseAsync, defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';

import type { Clock } from '@/shared/domain/calendar/clock';
import type { Logger } from '@/shared/lib/logger';

import type { AppDatabaseHandle } from './client';
import { DATABASE_NAME } from './client';

/** Archivo de la base copiado a la carpeta pedida. */
export interface CopiedDatabaseFile {
  readonly uri: string;
  /** Nombre dentro del ZIP: `cuantovendi.db` y, en modo crudo, sus `-wal` y `-shm`. */
  readonly entryName: string;
}

/** Resultado de {@link DatabaseCopier.copyTo}. */
export interface DatabaseCopy {
  readonly mode: 'backup_api' | 'raw_files';
  readonly files: readonly CopiedDatabaseFile[];
}

/** Copia la base sin escribir en ella (ADR-006). */
export interface DatabaseCopier {
  copyTo(directoryUri: string): Promise<DatabaseCopy>;
}

/** Dependencias de {@link createDatabaseCopier}. */
export interface DatabaseCopierDeps {
  /** Base ya abierta; puede lanzar si la base no se pudo abrir. */
  readonly getHandle: () => AppDatabaseHandle;
  readonly clock: Clock;
  readonly logger: Logger;
}

const FILE_SCHEME = 'file://';
const RAW_SUFFIXES = ['', '-wal', '-shm'] as const;

function toFilesystemPath(directoryUri: string): string {
  const withoutScheme = directoryUri.startsWith(FILE_SCHEME)
    ? directoryUri.slice(FILE_SCHEME.length)
    : directoryUri;
  return decodeURI(withoutScheme).replace(/\/+$/, '');
}

function joinUri(directoryUri: string, name: string): string {
  return `${directoryUri.replace(/\/+$/, '')}/${name}`;
}

/**
 * Crea el copiador de la exportación de emergencia (ADR-006, backup.md 4.5). Con la base abierta
 * usa `backupDatabaseAsync` hacia un `.db` nuevo `cuantovendi-<epochMs>.db`; si la base no abre
 * o la API falla, copia los archivos crudos `cuantovendi.db`, `-wal` y `-shm`. Nunca escribe en
 * la base de origen: solo la lee o copia sus archivos. `expo-sqlite` recibe la carpeta como ruta
 * sin esquema (verificado en el código nativo de Android; iOS no se verifica en la v1, D-23).
 * @throws {Error} Si no hay ningún archivo de base que copiar.
 */
export function createDatabaseCopier(deps: DatabaseCopierDeps): DatabaseCopier {
  async function copyWithBackupApi(directoryUri: string, copyName: string): Promise<DatabaseCopy> {
    const source = deps.getHandle().native;
    const destination = await openDatabaseAsync(copyName, {}, toFilesystemPath(directoryUri));
    try {
      await backupDatabaseAsync({ sourceDatabase: source, destDatabase: destination });
    } finally {
      await destination.closeAsync();
    }
    return {
      mode: 'backup_api',
      files: [{ uri: joinUri(directoryUri, copyName), entryName: DATABASE_NAME }],
    };
  }

  async function copyRawFiles(directoryUri: string, copyName: string): Promise<DatabaseCopy> {
    const sourceDirectory = `${FILE_SCHEME}${String(defaultDatabaseDirectory)}`;
    const files: CopiedDatabaseFile[] = [];
    for (const suffix of RAW_SUFFIXES) {
      const source = new File(sourceDirectory, `${DATABASE_NAME}${suffix}`);
      if (source.exists) {
        const target = joinUri(directoryUri, `${copyName}${suffix}`);
        await source.copy(new File(target), { overwrite: true });
        files.push({ uri: target, entryName: `${DATABASE_NAME}${suffix}` });
      }
    }
    if (files.length === 0) {
      throw new Error('There is no database file to copy.');
    }
    return { mode: 'raw_files', files };
  }

  return {
    copyTo: async (directoryUri) => {
      const copyName = `cuantovendi-${String(deps.clock.now())}.db`;
      try {
        return await copyWithBackupApi(directoryUri, copyName);
      } catch (error) {
        deps.logger.warn('emergency_backup_api_failed', { error: String(error) });
        return copyRawFiles(directoryUri, copyName);
      }
    },
  };
}

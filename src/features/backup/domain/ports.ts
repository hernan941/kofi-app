import type { EpochMs } from '@/shared/domain';

/** Lectura con acceso aleatorio (ADR-012). `read` devuelve exactamente `length` bytes o falla. */
export interface RandomAccessFile {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  close(): void;
}

/** Escritura secuencial. */
export interface SequentialWriter {
  readonly position: number;
  write(bytes: Uint8Array): Promise<void>;
  close(): void;
}

/** E/S de archivos para respaldos (ADR-012); adaptador delgado sobre `FileHandle`. */
export interface ArchiveIo {
  openForRead(uri: string): Promise<RandomAccessFile>;
  /** Crea o trunca el archivo (con carpetas intermedias). */
  createForWrite(uri: string): Promise<SequentialWriter>;
  /** Copia exactamente `[offset, offset + length)` de `source` a `targetUri`, por bloques de 1 MiB. */
  copyRange(
    source: RandomAccessFile,
    offset: number,
    length: number,
    targetUri: string,
  ): Promise<void>;
  /** Hex en minúsculas. */
  sha256OfFile(uri: string): Promise<string>;
  sha256OfBytes(bytes: Uint8Array): Promise<string>;
  availableDiskSpace(): number;
}

/** Respaldo de seguridad existente. */
export interface SafetyBackupInfo {
  readonly uri: string;
  readonly createdAt: EpochMs;
}

/** Destino de un respaldo de seguridad: se escribe en `partUri` y se promueve a `finalUri`. */
export interface SafetyTarget {
  readonly partUri: string;
  readonly finalUri: string;
}

/**
 * Carpetas propias de los respaldos. Solo arma rutas desde nombres generados por
 * `domain/file-names.ts` y validados por patrón, y solo borra dentro de sus carpetas.
 */
export interface BackupFiles {
  /**
   * `Paths.cache/backups/<fileName>`; crea la carpeta y borra un archivo previo con ese nombre.
   * @throws {Error} Si el nombre no es uno de los que genera la exportación.
   */
  exportTarget(fileName: string): string;
  /** `Paths.document/safety/cuantovendi-seguridad-<createdAt>.zip(.part)`; crea la carpeta. */
  safetyTarget(createdAt: EpochMs): SafetyTarget;
  /** Renombra el `.part` al nombre final. */
  promoteSafety(target: SafetyTarget): Promise<void>;
  /** Borra todo lo de `safety/` salvo `keepUri` (D-22). */
  pruneSafety(keepUri: string): Promise<void>;
  /** El respaldo de seguridad más nuevo, o `null` si no hay. */
  latestSafety(): SafetyBackupInfo | null;
  /**
   * Archivo de la caché (`DocumentPicker/`) donde copiar la copia de seguridad antes de
   * restaurarla, para que el respaldo nuevo pueda reemplazarla; crea la carpeta y borra una
   * copia anterior. `discardPicked` lo borra al terminar.
   */
  restoreCopyTarget(): string;
  /** `Paths.cache/emergency/`; crea la carpeta. */
  emergencyDirectory(): string;
  /** Borra todo lo que haya en `Paths.cache/emergency/`, de una exportación anterior. */
  clearEmergencyDirectory(): void;
  /** Borra la copia del selector si está bajo `Paths.cache`; si no, la registra y no la toca. */
  discardPicked(uri: string): void;
  /**
   * Borra los archivos de `backups/`, `emergency/` y `DocumentPicker/`, y los `.part` de
   * `safety/`, con más de `minAgeMs` de antigüedad. Conserva solo el `.zip` más nuevo de `safety/`.
   */
  sweep(now: EpochMs, minAgeMs: number): Promise<{ readonly removed: number }>;
}

/** Menú de compartir del sistema (ADR-005), con `isAvailable` agregado. */
export interface FileSharer {
  isAvailable(): Promise<boolean>;
  share(
    fileUri: string,
    options: { readonly mimeType: string; readonly uti?: string },
  ): Promise<void>;
}

/** Archivo de la base copiado para la exportación de emergencia. */
export interface CopiedDatabaseFile {
  readonly uri: string;
  /** `cuantovendi.db` y, en modo crudo, `cuantovendi.db-wal` y `cuantovendi.db-shm`. */
  readonly entryName: string;
}

/** Copia la base sin escribir en ella (ADR-006). La implementación vive en `core/db`. */
export interface DatabaseCopier {
  copyTo(directoryUri: string): Promise<{
    readonly mode: 'backup_api' | 'raw_files';
    readonly files: readonly CopiedDatabaseFile[];
  }>;
}

/** Documento elegido, ya copiado a la caché por el selector. */
export interface PickedDocument {
  readonly uri: string;
  readonly name: string;
  readonly size: number | null;
}

/** Selector de archivos del sistema (ADR-005); `null` si la persona cancela. */
export interface DocumentPicker {
  pickSingle(options: { readonly mimeTypes: readonly string[] }): Promise<PickedDocument | null>;
}

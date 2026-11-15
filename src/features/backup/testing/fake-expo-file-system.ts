import { createHash } from 'node:crypto';

/** Archivo del sistema de archivos simulado. */
export interface FakeStoredFile {
  bytes: Uint8Array;
  modifiedAt: number;
}

const CACHE_URI = 'file:///data/cache/';
const DOCUMENT_URI = 'file:///data/doc/';

function joinUris(parts: readonly unknown[]): string {
  const segments = parts.map((part) =>
    typeof part === 'string' ? part : (part as { uri: string }).uri,
  );
  return segments.reduce((accumulated, segment, index) =>
    index === 0
      ? segment
      : `${accumulated.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '').replace(/\/+$/, '')}`,
  );
}

/**
 * Estado del doble de `expo-file-system` que usan los tests de adaptadores: archivos y carpetas
 * en memoria, espacio libre y fallas inyectables. `reset` lo deja como nuevo.
 */
export class FakeFileSystemState {
  files = new Map<string, FakeStoredFile>();
  directories = new Set<string>();
  /** Tope de bytes por lectura, para simular lecturas cortas del sistema. */
  maxReadBytes = Number.POSITIVE_INFINITY;
  availableDiskSpace = 10_000_000_000;
  openHandles = 0;
  closedHandles = 0;
  readFailureAtCall: number | null = null;
  writeFailureAtCall: number | null = null;
  deleteFailures = new Set<string>();
  readCalls = 0;
  writeCalls = 0;
  now = 1_000_000;

  reset(): void {
    this.files = new Map();
    this.directories = new Set();
    this.availableDiskSpace = 10_000_000_000;
    this.openHandles = 0;
    this.closedHandles = 0;
    this.readFailureAtCall = null;
    this.writeFailureAtCall = null;
    this.deleteFailures = new Set();
    this.readCalls = 0;
    this.writeCalls = 0;
    this.now = 1_000_000;
    this.maxReadBytes = Number.POSITIVE_INFINITY;
  }

  /** Crea un archivo (y sus carpetas) con esos bytes. */
  put(uri: string, bytes: Uint8Array | string, modifiedAt: number = this.now): void {
    const content = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    this.files.set(uri, { bytes: content.slice(), modifiedAt });
    this.directories.add(`${uri.slice(0, uri.lastIndexOf('/'))}/`);
  }

  /** Bytes del archivo, o `undefined` si no existe. */
  read(uri: string): Uint8Array | undefined {
    return this.files.get(uri)?.bytes;
  }

  /** Nombres de los archivos que cuelgan directamente de una carpeta. */
  namesIn(directoryUri: string): string[] {
    const prefix = `${directoryUri.replace(/\/+$/, '')}/`;
    return [...this.files.keys()]
      .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
      .map((uri) => uri.slice(prefix.length));
  }
}

/** Instancia compartida entre el doble de `expo-file-system` y los tests. */
export const fakeFileSystem = new FakeFileSystemState();

/** Fabrica el módulo `expo-file-system` simulado sobre {@link fakeFileSystem}. */
export function createFakeExpoFileSystemModule() {
  const state = fakeFileSystem;

  class FakeFileHandle {
    offset: number | null = 0;
    private readonly uri: string;
    private readonly writable: boolean;
    private closed = false;

    constructor(uri: string, mode: string) {
      this.uri = uri;
      this.writable = mode !== 'r';
      state.openHandles += 1;
    }

    get size(): number | null {
      return this.closed ? null : (state.files.get(this.uri)?.bytes.length ?? 0);
    }

    close(): void {
      if (this.closed) {
        throw new Error('The handle is already closed.');
      }
      this.closed = true;
      state.openHandles -= 1;
      state.closedHandles += 1;
    }

    async readBytes(length: number): Promise<Uint8Array> {
      this.assertOpen();
      state.readCalls += 1;
      if (state.readFailureAtCall === state.readCalls) {
        throw new Error('read failed');
      }
      await Promise.resolve();
      const start = this.offset ?? 0;
      const bytes = state.files.get(this.uri)?.bytes ?? new Uint8Array(0);
      const chunk = bytes.slice(start, start + Math.min(length, state.maxReadBytes));
      this.offset = start + chunk.length;
      return chunk;
    }

    async writeBytes(chunk: Uint8Array): Promise<void> {
      this.assertOpen();
      if (!this.writable) {
        throw new Error('The handle is read only.');
      }
      state.writeCalls += 1;
      if (state.writeFailureAtCall === state.writeCalls) {
        throw new Error('write failed');
      }
      await Promise.resolve();
      const stored = state.files.get(this.uri);
      if (stored === undefined) {
        throw new Error('The file does not exist.');
      }
      const start = this.offset ?? 0;
      const next = new Uint8Array(Math.max(stored.bytes.length, start + chunk.length));
      next.set(stored.bytes);
      next.set(chunk, start);
      stored.bytes = next;
      stored.modifiedAt = state.now;
      this.offset = start + chunk.length;
    }

    private assertOpen(): void {
      if (this.closed) {
        throw new Error('The handle is closed.');
      }
    }
  }

  class FakeDirectory {
    readonly uri: string;

    constructor(...parts: unknown[]) {
      this.uri = `${joinUris(parts).replace(/\/+$/, '')}/`;
    }

    get name(): string {
      return this.uri.replace(/\/+$/, '').split('/').pop() ?? '';
    }

    get exists(): boolean {
      return state.directories.has(this.uri);
    }

    create(options?: { intermediates?: boolean; idempotent?: boolean }): void {
      if (this.exists && options?.idempotent !== true) {
        throw new Error('The directory already exists.');
      }
      state.directories.add(this.uri);
    }

    delete(): void {
      state.directories.delete(this.uri);
    }

    list(): (FakeDirectory | FakeFile)[] {
      return state.namesIn(this.uri).map((name) => new FakeFile(this.uri, name));
    }
  }

  class FakeFile {
    readonly uri: string;

    constructor(...parts: unknown[]) {
      this.uri = joinUris(parts);
    }

    get name(): string {
      return this.uri.split('/').pop() ?? '';
    }

    get exists(): boolean {
      return state.files.has(this.uri);
    }

    get size(): number {
      return state.files.get(this.uri)?.bytes.length ?? 0;
    }

    get lastModified(): number | null {
      return state.files.get(this.uri)?.modifiedAt ?? null;
    }

    get parentDirectory(): FakeDirectory {
      return new FakeDirectory(this.uri.slice(0, this.uri.lastIndexOf('/')));
    }

    create(options?: { overwrite?: boolean; intermediates?: boolean }): void {
      if (this.exists && options?.overwrite !== true) {
        throw new Error('The file already exists.');
      }
      state.put(this.uri, new Uint8Array(0));
    }

    delete(): void {
      if (state.deleteFailures.has(this.uri)) {
        throw new Error('delete failed');
      }
      if (!state.files.delete(this.uri)) {
        throw new Error('The file does not exist.');
      }
    }

    open(mode = 'r'): FakeFileHandle {
      const stored = state.files.get(this.uri);
      if (stored === undefined) {
        throw new Error('The file does not exist.');
      }
      if (mode === 'wt') {
        stored.bytes = new Uint8Array(0);
      }
      return new FakeFileHandle(this.uri, mode);
    }

    digest(): Promise<string> {
      const bytes = state.files.get(this.uri)?.bytes;
      if (bytes === undefined) {
        return Promise.reject(new Error('The file does not exist.'));
      }
      return Promise.resolve(createHash('sha256').update(bytes).digest('hex').toUpperCase());
    }

    move(destination: { uri: string }, options?: { overwrite?: boolean }): Promise<void> {
      const stored = state.files.get(this.uri);
      if (stored === undefined) {
        return Promise.reject(new Error('The source does not exist.'));
      }
      if (state.files.has(destination.uri) && options?.overwrite !== true) {
        return Promise.reject(new Error('The destination exists.'));
      }
      state.files.delete(this.uri);
      state.files.set(destination.uri, stored);
      return Promise.resolve();
    }
  }

  return {
    File: FakeFile,
    Directory: FakeDirectory,
    FileMode: {
      ReadWrite: 'rw',
      ReadOnly: 'r',
      WriteOnly: 'w',
      Append: 'wa',
      Truncate: 'wt',
    },
    Paths: {
      cache: new FakeDirectory(CACHE_URI),
      document: new FakeDirectory(DOCUMENT_URI),
      get availableDiskSpace() {
        return state.availableDiskSpace;
      },
    },
  };
}

/** Llamadas que recibió el doble de `expo-crypto`. */
export const fakeCryptoCalls: { algorithm: string; length: number }[] = [];

/** Fabrica el módulo `expo-crypto` simulado: `digest` calcula SHA-256 real y registra la llamada. */
export function createFakeExpoCryptoModule() {
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: (algorithm: string, data: Uint8Array): Promise<ArrayBuffer> => {
      fakeCryptoCalls.push({ algorithm, length: data.length });
      const hash = createHash('sha256').update(data).digest();
      return Promise.resolve(hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength));
    },
  };
}

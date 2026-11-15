import { createHash } from 'node:crypto';

import type { ArchiveIo, RandomAccessFile, SequentialWriter } from '../domain/ports';
import { MemoryFile } from './in-memory-zip-files';

const COPY_BLOCK_BYTES = 1_048_576;

/** `SequentialWriter` que publica cada escritura en el mapa de archivos del doble. */
class MapWriter implements SequentialWriter {
  position = 0;
  closed = false;

  constructor(
    private readonly files: Map<string, Uint8Array>,
    private readonly uri: string,
    private readonly failWritesAt: () => number | null,
    private readonly countWrite: () => number,
  ) {}

  write(bytes: Uint8Array): Promise<void> {
    if (this.failWritesAt() === this.countWrite()) {
      return Promise.reject(new Error('write failed'));
    }
    const current = this.files.get(this.uri) ?? new Uint8Array(0);
    const next = new Uint8Array(current.length + bytes.length);
    next.set(current);
    next.set(bytes, current.length);
    this.files.set(this.uri, next);
    this.position += bytes.length;
    return Promise.resolve();
  }

  close(): void {
    this.closed = true;
  }
}

/**
 * `ArchiveIo` sobre un mapa `uri → bytes`, con espacio libre configurable, SHA-256 real y
 * fallas inyectables. Registra los archivos creados y los lectores abiertos para los tests.
 */
export class InMemoryArchiveIo implements ArchiveIo {
  readonly files = new Map<string, Uint8Array>();
  readonly created: string[] = [];
  readonly readers: MemoryFile[] = [];
  readonly writers: MapWriter[] = [];
  readonly hashedFiles: string[] = [];
  freeSpace = Number.MAX_SAFE_INTEGER;
  failWriteAtCall: number | null = null;
  private writeCalls = 0;

  /** Crea o reemplaza un archivo. */
  put(uri: string, bytes: Uint8Array): void {
    this.files.set(uri, bytes.slice());
  }

  openForRead(uri: string): Promise<RandomAccessFile> {
    const bytes = this.files.get(uri);
    if (bytes === undefined) {
      return Promise.reject(new Error(`File not found: ${uri}`));
    }
    const file = new MemoryFile(bytes);
    this.readers.push(file);
    return Promise.resolve(file);
  }

  createForWrite(uri: string): Promise<SequentialWriter> {
    this.files.set(uri, new Uint8Array(0));
    this.created.push(uri);
    const writer = new MapWriter(
      this.files,
      uri,
      () => this.failWriteAtCall,
      () => {
        this.writeCalls += 1;
        return this.writeCalls;
      },
    );
    this.writers.push(writer);
    return Promise.resolve(writer);
  }

  async copyRange(
    source: RandomAccessFile,
    offset: number,
    length: number,
    targetUri: string,
  ): Promise<void> {
    const writer = await this.createForWrite(targetUri);
    try {
      for (let copied = 0; copied < length; copied += COPY_BLOCK_BYTES) {
        const block = Math.min(COPY_BLOCK_BYTES, length - copied);
        await writer.write(await source.read(offset + copied, block));
      }
    } finally {
      writer.close();
    }
  }

  sha256OfFile(uri: string): Promise<string> {
    const bytes = this.files.get(uri);
    if (bytes === undefined) {
      return Promise.reject(new Error(`File not found: ${uri}`));
    }
    this.hashedFiles.push(uri);
    return this.sha256OfBytes(bytes);
  }

  sha256OfBytes(bytes: Uint8Array): Promise<string> {
    return Promise.resolve(createHash('sha256').update(bytes).digest('hex'));
  }

  availableDiskSpace(): number {
    return this.freeSpace;
  }

  /** Indica si todos los lectores y escritores abiertos ya se cerraron. */
  allClosed(): boolean {
    return this.readers.every((reader) => reader.closed) && this.writers.every((w) => w.closed);
  }
}

import type { RandomAccessFile, SequentialWriter } from '../domain/ports';

/** `RandomAccessFile` sobre bytes en memoria; cuenta los bytes leídos para los tests. */
export class MemoryFile implements RandomAccessFile {
  readonly size: number;
  readonly reads: { offset: number; length: number }[] = [];
  closed = false;

  constructor(private readonly bytes: Uint8Array) {
    this.size = bytes.length;
  }

  read(offset: number, length: number): Promise<Uint8Array> {
    this.reads.push({ offset, length });
    if (offset < 0 || length < 0 || offset + length > this.bytes.length) {
      return Promise.reject(new RangeError('read out of range'));
    }
    return Promise.resolve(this.bytes.slice(offset, offset + length));
  }

  close(): void {
    this.closed = true;
  }
}

/** `SequentialWriter` en memoria. */
export class MemoryWriter implements SequentialWriter {
  private chunks: Uint8Array[] = [];
  position = 0;
  closed = false;

  write(bytes: Uint8Array): Promise<void> {
    this.chunks.push(bytes.slice());
    this.position += bytes.length;
    return Promise.resolve();
  }

  close(): void {
    this.closed = true;
  }

  /** Todo lo escrito, en orden. */
  toBytes(): Uint8Array {
    const out = new Uint8Array(this.position);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

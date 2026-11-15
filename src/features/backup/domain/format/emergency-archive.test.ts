import { InMemoryArchiveIo } from '../../testing/in-memory-archive-io';
import { MemoryWriter } from '../../testing/in-memory-zip-files';
import { buildZip, textEntry } from '../../testing/zip-fixture-builder';
import { writeStoredArchive, type ArchiveEntryInput } from '../zip/archive';
import { encodeUtf8 } from '../utf8';
import { isEmergencyArchive } from './emergency-archive';

const INFO = JSON.stringify({ kind: 'cuantovendi-emergency', reason: 'migration_failed' });

function bytesEntry(path: string, bytes: Uint8Array): ArchiveEntryInput {
  return { path, size: bytes.length, readRange: (o, l) => Promise.resolve(bytes.slice(o, o + l)) };
}

async function emergencyZip(info: string = INFO): Promise<Uint8Array> {
  const writer = new MemoryWriter();
  await writeStoredArchive(writer, [
    bytesEntry('info.json', encodeUtf8(info)),
    bytesEntry('cuantovendi.db', new Uint8Array(40_000)),
  ]);
  return writer.toBytes();
}

async function check(bytes: Uint8Array): Promise<boolean> {
  const io = new InMemoryArchiveIo();
  io.put('file:///x.zip', bytes);
  const file = await io.openForRead('file:///x.zip');
  return isEmergencyArchive(file);
}

describe('isEmergencyArchive', () => {
  it('recognises the archive that the emergency export writes', async () => {
    await expect(check(await emergencyZip())).resolves.toBe(true);
  });

  it('rejects an info.json of another kind', async () => {
    await expect(check(await emergencyZip('{"kind":"other"}'))).resolves.toBe(false);
  });

  it('rejects an info.json that is not JSON', async () => {
    await expect(check(await emergencyZip('not json'))).resolves.toBe(false);
  });

  it('rejects an archive whose first entry is another file', async () => {
    await expect(check(buildZip([textEntry('manifest.json', INFO)]))).resolves.toBe(false);
  });

  it('rejects an info.json whose checksum does not match', async () => {
    const zip = buildZip([{ ...textEntry('info.json', INFO), crc32: 1 }]);
    await expect(check(zip)).resolves.toBe(false);
  });

  it('rejects an oversized info.json without reading it', async () => {
    const big = JSON.stringify({ kind: 'cuantovendi-emergency', pad: 'x'.repeat(70_000) });
    await expect(check(buildZip([textEntry('info.json', big)]))).resolves.toBe(false);
  });

  it('rejects bytes shorter than a local header', async () => {
    await expect(check(new Uint8Array([0x50, 0x4b, 3, 4]))).resolves.toBe(false);
  });
});

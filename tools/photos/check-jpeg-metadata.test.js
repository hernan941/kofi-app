const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'check-jpeg-metadata.mjs');

function segment(marker, body) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(body.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, body]);
}

function tiffWithTags(tags, littleEndian) {
  const write16 = (buffer, value, offset) =>
    littleEndian ? buffer.writeUInt16LE(value, offset) : buffer.writeUInt16BE(value, offset);
  const write32 = (buffer, value, offset) =>
    littleEndian ? buffer.writeUInt32LE(value, offset) : buffer.writeUInt32BE(value, offset);
  const buffer = Buffer.alloc(8 + 2 + tags.length * 12 + 4);
  buffer.write(littleEndian ? 'II' : 'MM', 0, 'latin1');
  write16(buffer, 42, 2);
  write32(buffer, 8, 4);
  write16(buffer, tags.length, 8);
  tags.forEach((tag, index) => {
    const offset = 10 + index * 12;
    write16(buffer, tag, offset);
    write16(buffer, 4, offset + 2);
    write32(buffer, 1, offset + 4);
    write32(buffer, 0, offset + 8);
  });
  return buffer;
}

function exifSegment({ gps = false, littleEndian = true } = {}) {
  const tags = gps ? [0x010f, 0x8825] : [0x010f];
  return segment(
    0xe1,
    Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiffWithTags(tags, littleEndian)]),
  );
}

const XMP = segment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>', 'latin1'));
const IPTC = segment(0xed, Buffer.from('Photoshop 3.0\0', 'latin1'));
const JFIF = segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const QUANT = segment(0xdb, Buffer.alloc(65));
const SCAN = Buffer.concat([segment(0xda, Buffer.from([0, 1, 2, 3])), Buffer.from([0xff, 0xd9])]);

function jpeg(...segments) {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, SCAN]);
}

let directory;

beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-jpeg-'));
});

afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(name, content) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, content);
  return spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
}

describe('check-jpeg-metadata', () => {
  it('exits 0 and says there is no metadata for a clean JPEG', () => {
    const result = run('clean.jpg', jpeg(JFIF, QUANT));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('sin metadatos');
  });

  it('reports APP1 Exif and exits non-zero', () => {
    const result = run('exif.jpg', jpeg(JFIF, exifSegment(), QUANT));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('APP1 Exif');
    expect(result.stdout).not.toContain('GPS');
  });

  it('reports GPS inside a little-endian Exif block', () => {
    const result = run('gps-le.jpg', jpeg(exifSegment({ gps: true, littleEndian: true })));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('APP1 Exif');
    expect(result.stdout).toContain('GPS');
  });

  it('reports GPS inside a big-endian Exif block', () => {
    const result = run('gps-be.jpg', jpeg(exifSegment({ gps: true, littleEndian: false })));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('GPS');
  });

  it('reports XMP and exits non-zero', () => {
    const result = run('xmp.jpg', jpeg(XMP));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('APP1 XMP');
  });

  it('reports IPTC (APP13) and exits non-zero', () => {
    const result = run('iptc.jpg', jpeg(IPTC));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('APP13 IPTC');
  });

  it('lists every metadata segment it finds', () => {
    const result = run('all.jpg', jpeg(exifSegment({ gps: true }), XMP, IPTC));

    expect(result.status).toBe(1);
    ['APP1 Exif', 'APP1 XMP', 'APP13 IPTC', 'GPS'].forEach((label) => {
      expect(result.stdout).toContain(label);
    });
  });

  it('ignores metadata-looking bytes after the start of the image data', () => {
    const tail = Buffer.concat([jpeg(JFIF), exifSegment({ gps: true })]);
    const result = run('after-scan.jpg', tail);

    expect(result.status).toBe(0);
  });

  it('exits 2 with an error for a file that is not a JPEG', () => {
    const result = run('text.jpg', Buffer.from('hola, no soy una foto'));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('no es un JPEG');
  });

  it('exits 2 when no path is given', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Uso');
  });

  it('exits 2 when the file does not exist', () => {
    const result = spawnSync(process.execPath, [SCRIPT, path.join(directory, 'missing.jpg')], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(2);
  });
});

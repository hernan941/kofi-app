#!/usr/bin/env node
/**
 * Development script (F2.9, `docs/architecture/product-photos.md` 5.8): walks the segments of a JPEG and
 * reports the metadata that a saved product photo must not carry: APP1 Exif, APP1 XMP, APP13 IPTC and
 * GPS coordinates inside the Exif block.
 *
 * Usage: `node tools/photos/check-jpeg-metadata.mjs <file.jpg>`.
 * Exit code: 0 when there is no metadata, 1 when something was found, 2 on a usage or file error.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MARKER_SOI = 0xd8;
const MARKER_SOS = 0xda;
const MARKER_EOI = 0xd9;
const MARKER_APP1 = 0xe1;
const MARKER_APP13 = 0xed;
const EXIF_HEADER = 'Exif\0\0';
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';
const GPS_IFD_POINTER_TAG = 0x8825;

/**
 * Reports whether a marker is standalone, that is, it has no length field.
 *
 * @param {number} marker Second byte of the marker.
 * @returns {boolean} `true` for TEM, RSTn, SOI and EOI.
 */
function isStandalone(marker) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

/**
 * Reports whether an Exif TIFF block has the GPS IFD pointer in its first directory.
 *
 * @param {Buffer} tiff TIFF block that follows the `Exif\0\0` header.
 * @returns {boolean} `true` when tag 0x8825 is present.
 */
function hasGpsTag(tiff) {
  if (tiff.length < 8) return false;
  const byteOrder = tiff.toString('latin1', 0, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return false;
  const littleEndian = byteOrder === 'II';
  const read16 = (offset) => (littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset));
  const read32 = (offset) => (littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset));
  const directory = read32(4);
  if (directory + 2 > tiff.length) return false;
  const entries = read16(directory);
  for (let index = 0; index < entries; index += 1) {
    const offset = directory + 2 + index * 12;
    if (offset + 12 > tiff.length) return false;
    if (read16(offset) === GPS_IFD_POINTER_TAG) return true;
  }
  return false;
}

/**
 * Lists the metadata found in a JPEG.
 *
 * @param {Buffer} bytes Whole file.
 * @returns {string[]} Labels such as `APP1 Exif`, `APP1 XMP`, `APP13 IPTC` and `GPS`; empty when clean.
 * @throws {Error} When the bytes are not a JPEG.
 */
export function findMetadata(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    throw new Error('el archivo no es un JPEG');
  }
  const found = [];
  let offset = 2;
  while (offset + 2 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === MARKER_SOS || marker === MARKER_EOI) break;
    if (isStandalone(marker)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) break;
    const size = bytes.readUInt16BE(offset + 2);
    const body = bytes.subarray(offset + 4, offset + 2 + size);
    if (marker === MARKER_APP1) {
      if (body.toString('latin1', 0, EXIF_HEADER.length) === EXIF_HEADER) {
        found.push('APP1 Exif');
        if (hasGpsTag(body.subarray(EXIF_HEADER.length))) found.push('GPS');
      } else if (body.toString('latin1', 0, XMP_HEADER.length) === XMP_HEADER) {
        found.push('APP1 XMP');
      }
    }
    if (marker === MARKER_APP13) found.push('APP13 IPTC');
    offset += 2 + size;
  }
  return found;
}

/**
 * Command line entry point.
 *
 * @param {string[]} args Arguments after the script name.
 * @returns {number} Process exit code.
 */
export function main(args) {
  const [file] = args;
  if (!file) {
    console.error('Uso: node tools/photos/check-jpeg-metadata.mjs <archivo.jpg>');
    return 2;
  }
  try {
    const found = findMetadata(readFileSync(file));
    if (found.length === 0) {
      console.log('sin metadatos (APP1 Exif, XMP, IPTC y GPS ausentes)');
      return 0;
    }
    console.log(`metadatos encontrados: ${found.join(', ')}`);
    return 1;
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

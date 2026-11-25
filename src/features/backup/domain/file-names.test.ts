import { epochMsSchema, localDateSchema } from '@/shared/domain';

import {
  PRODUCTS_CSV_FILE_NAME,
  SALES_CSV_FILE_NAME,
  backupFileName,
  emergencyFileName,
  isExportFileName,
  parseSafetyFileName,
  safetyFileName,
} from './file-names';

const DATE = localDateSchema.parse('2026-11-13');

describe('backup file names', () => {
  it('names the backup and the emergency copy after the local date', () => {
    expect(backupFileName(DATE)).toBe('kofi-respaldo-2026-11-13.zip');
    expect(emergencyFileName(DATE)).toBe('kofi-emergencia-2026-11-13.zip');
  });

  it('keeps the CSV names fixed', () => {
    expect(SALES_CSV_FILE_NAME).toBe('ventas.csv');
    expect(PRODUCTS_CSV_FILE_NAME).toBe('productos.csv');
  });

  it('writes the safety backup name with a 13 digit instant and reads it back', () => {
    const createdAt = epochMsSchema.parse(1_800_000_000_123);

    const name = safetyFileName(createdAt);

    expect(name).toBe('cuantovendi-seguridad-1800000000123.zip');
    expect(parseSafetyFileName(name)).toBe(createdAt);
  });

  it('pads small instants to 13 digits', () => {
    expect(safetyFileName(epochMsSchema.parse(5))).toBe('cuantovendi-seguridad-0000000000005.zip');
  });

  it.each([
    'cuantovendi-seguridad-1.zip',
    'cuantovendi-seguridad-1800000000123.zip.part',
    '../cuantovendi-seguridad-1800000000123.zip',
    'otro.zip',
  ])('rejects the safety name %j', (name) => {
    expect(parseSafetyFileName(name)).toBeNull();
  });

  it.each([
    ['kofi-respaldo-2026-11-13.zip', true],
    ['cuantovendi-respaldo-2026-11-13.zip', true],
    ['cuantovendi-respaldo-2026-13-45.zip', false],
    ['ventas.csv', true],
    ['productos.csv', true],
    ['../ventas.csv', false],
    ['kofi-respaldo-2026-13-45.zip', false],
    ['kofi-respaldo-2026-11-13.zip.part', false],
    ['photos/a.jpg', false],
  ])('validates the export name %j', (name, expected) => {
    expect(isExportFileName(name)).toBe(expected);
  });
});

import { GUILT_PATTERNS } from '@/shared/lib/testing/guilt-patterns';

import type { ExportError, RestoreError } from '../domain/errors';
import {
  RESTORE_STEP_LABELS,
  exportProblemMessage,
  exportProgressView,
  currentCountsSentence,
  formatCount,
  previewCardLabel,
  restoreProblemMessage,
  type ExportKind,
} from './backup-messages';

const RESTORE_ERRORS: readonly RestoreError[] = [
  { code: 'not_a_backup' },
  { code: 'emergency_backup' },
  { code: 'invalid_archive', reason: 'not_a_zip' },
  { code: 'invalid_archive', reason: 'too_large' },
  { code: 'newer_format', formatVersion: 2 },
  { code: 'entries_mismatch' },
  { code: 'checksum_mismatch', path: 'data.json' },
  { code: 'invalid_data', issues: [] },
  { code: 'broken_references' },
  { code: 'photo_conflict', photoId: 'x' },
  { code: 'not_enough_space', requiredBytes: 350_000_000 },
  { code: 'current_data_too_large' },
];

const EXPORT_ERRORS: readonly ExportError[] = [
  { code: 'not_enough_space', requiredBytes: 1_200_000_001 },
  { code: 'too_large' },
  { code: 'inconsistent_data' },
  { code: 'sharing_unavailable' },
];

const FORBIDDEN = /\b(zip|crc|hash|json|sql)\b|error/i;

function everyText(): string[] {
  const kinds: ExportKind[] = ['backup', 'sheet'];
  return [
    ...[...RESTORE_ERRORS, 'unexpected' as const].flatMap((problem) => {
      const { title, message } = restoreProblemMessage(problem);
      return [title, message];
    }),
    ...kinds.flatMap((kind) =>
      [...EXPORT_ERRORS, 'unexpected' as const].map((problem) =>
        exportProblemMessage(problem, kind),
      ),
    ),
    ...Object.values(RESTORE_STEP_LABELS),
  ];
}

describe('restoreProblemMessage', () => {
  it.each(RESTORE_ERRORS.map((error) => [error.code, error] as const))(
    'has a title and a sentence for %s',
    (_code, error) => {
      const { title, message } = restoreProblemMessage(error);

      expect(title.length).toBeGreaterThan(0);
      expect(message.length).toBeGreaterThan(0);
    },
  );

  it('has one for an unexpected failure', () => {
    expect(restoreProblemMessage('unexpected')).toEqual({
      title: 'No pudimos terminar',
      message: 'Vuelve a intentarlo en un momento.',
      offersAnotherFile: false,
    });
  });

  it('tells a file that is not a backup how to find the right one', () => {
    expect(restoreProblemMessage({ code: 'not_a_backup' })).toMatchObject({
      title: 'Este archivo no es un respaldo de Kofi',
      offersAnotherFile: true,
    });
    expect(restoreProblemMessage({ code: 'not_a_backup' }).message).toEqual(
      expect.stringMatching(/kofi-respaldo.*cuantovendi-respaldo/),
    );
  });

  it('tells an oversized file apart from a damaged one', () => {
    expect(restoreProblemMessage({ code: 'invalid_archive', reason: 'too_large' }).title).toBe(
      'Este archivo es demasiado grande',
    );
    expect(restoreProblemMessage({ code: 'invalid_archive', reason: 'not_a_zip' }).title).toBe(
      'No pudimos leer este respaldo',
    );
  });

  it('recognizes an emergency copy', () => {
    expect(restoreProblemMessage({ code: 'emergency_backup' }).title).toBe(
      'Esta es una copia de emergencia',
    );
  });

  it('says how much space is needed', () => {
    expect(
      restoreProblemMessage({ code: 'not_enough_space', requiredBytes: 350_000_000 }).message,
    ).toContain('350 MB');
  });

  it('explains that the current data does not fit in a safety backup', () => {
    expect(restoreProblemMessage({ code: 'current_data_too_large' })).toMatchObject({
      offersAnotherFile: false,
    });
  });

  it.each([
    'newer_format',
    'photo_conflict',
    'not_enough_space',
    'current_data_too_large',
  ] as const)('does not offer another file for %s', (code) => {
    const error = RESTORE_ERRORS.find((candidate) => candidate.code === code);
    if (error === undefined) throw new Error('missing');

    expect(restoreProblemMessage(error).offersAnotherFile).toBe(false);
  });
});

describe('exportProblemMessage', () => {
  it.each(EXPORT_ERRORS.map((error) => [error.code, error] as const))(
    'has a message for %s in both kinds of export',
    (_code, error) => {
      expect(exportProblemMessage(error, 'backup').length).toBeGreaterThan(0);
      expect(exportProblemMessage(error, 'sheet').length).toBeGreaterThan(0);
    },
  );

  it('rounds the needed space up', () => {
    expect(
      exportProblemMessage({ code: 'not_enough_space', requiredBytes: 1_200_000_001 }, 'backup'),
    ).toBe(
      'No hay espacio suficiente para crear el respaldo. Libera al menos 1,3 GB y vuelve a intentarlo.',
    );
    expect(exportProblemMessage({ code: 'not_enough_space', requiredBytes: 10 }, 'sheet')).toBe(
      'No hay espacio suficiente para crear la planilla. Libera al menos 1 MB y vuelve a intentarlo.',
    );
  });

  it('has an unexpected message per kind', () => {
    expect(exportProblemMessage('unexpected', 'backup')).toBe(
      'No se pudo crear el respaldo. Inténtalo de nuevo.',
    );
    expect(exportProblemMessage('unexpected', 'sheet')).toBe(
      'No se pudo crear la planilla. Inténtalo de nuevo.',
    );
  });
});

describe('every text', () => {
  it('has no guilt, no technical words and no "error"', () => {
    for (const text of everyText()) {
      expect(text).not.toMatch(FORBIDDEN);
      for (const pattern of GUILT_PATTERNS) {
        expect(text.normalize('NFD').replace(/\p{M}/gu, '')).not.toMatch(pattern);
      }
    }
  });
});

describe('exportProgressView', () => {
  it.each([
    [{ phase: 'reading' }, 'Leyendo tus datos…', undefined],
    [
      { phase: 'hashing_photos', done: 3, total: 10 },
      'Revisando tus fotos: 3 de 10',
      { done: 3, total: 10 },
    ],
    [
      { phase: 'writing', done: 1, total: 12 },
      'Creando el archivo: 1 de 12',
      { done: 1, total: 12 },
    ],
    [{ phase: 'sharing' }, 'Abriendo el menú para compartir…', undefined],
  ] as const)('describes %j', (progress, label, bar) => {
    expect(exportProgressView(progress)).toMatchObject({ label, progress: bar });
  });

  it('has the phase text without numbers for the announcement', () => {
    expect(exportProgressView({ phase: 'writing', done: 1, total: 12 }).announcement).toBe(
      'Creando el archivo…',
    );
  });
});

describe('formatCount and previewCardLabel', () => {
  it('uses a dot as thousands separator', () => {
    expect(formatCount(1250)).toBe('1.250');
    expect(formatCount(12)).toBe('12');
    expect(formatCount(1234567)).toBe('1.234.567');
  });

  it('sums up the card in one phrase', () => {
    expect(
      previewCardLabel('Respaldo del 13 de noviembre de 2026, 15:42', {
        products: 24,
        saleRecords: 312,
        activePhotos: 40,
      }),
    ).toBe('Respaldo del 13 de noviembre de 2026, 15:42: 24 productos, 312 ventas y 40 fotos');
  });

  it('uses the singular with 1', () => {
    expect(
      previewCardLabel('Copia de hoy, 9:05', { products: 1, saleRecords: 1, activePhotos: 1 }),
    ).toBe('Copia de hoy, 9:05: 1 producto, 1 venta y 1 foto');
  });
});

describe('currentCountsSentence', () => {
  it('says what the app has today', () => {
    expect(currentCountsSentence({ products: 30, saleRecords: 350, activePhotos: 1 })).toBe(
      'Hoy tienes 30 productos, 350 ventas y 1 foto en la app.',
    );
  });

  it('says the app is empty when there is nothing', () => {
    expect(currentCountsSentence({ products: 0, saleRecords: 0, activePhotos: 0 })).toBe(
      'Hoy la app no tiene productos, ventas ni fotos.',
    );
  });
});

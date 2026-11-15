import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { emergencyExportMessage } from './emergency-export-messages';

describe('emergencyExportMessage', () => {
  it('asks to free the missing space in readable units', () => {
    expect(emergencyExportMessage({ code: 'not_enough_space', requiredBytes: 350_000_000 })).toBe(
      'No hay espacio suficiente para la copia. Libera al menos 350 MB y vuelve a intentarlo.',
    );
  });

  it('explains that the phone cannot share files', () => {
    expect(emergencyExportMessage({ code: 'sharing_unavailable' })).toBe(
      'Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo.',
    );
  });

  it('tells the person not to uninstall when the database cannot be copied', () => {
    expect(emergencyExportMessage({ code: 'database_unavailable' })).toBe(
      'No pudimos copiar tus datos. Cierra la app y vuelve a intentarlo. No la desinstales: así tus datos se quedan en el teléfono.',
    );
  });

  it('has a friendly message for an unexpected failure', () => {
    expect(emergencyExportMessage('unexpected')).toBe(
      'No pudimos crear la copia. Vuelve a intentarlo en un momento.',
    );
  });

  it.each([
    { code: 'not_enough_space', requiredBytes: 1 },
    { code: 'sharing_unavailable' },
    { code: 'database_unavailable' },
    'unexpected',
  ] as const)('uses no technical words and no guilt for %j', (error) => {
    const message = emergencyExportMessage(error);

    expect(message).not.toMatch(/\b(zip|crc|hash|json|sql|error)\b/i);
    expect(findGuiltPattern(message)).toBeNull();
  });
});

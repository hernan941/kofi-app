import type { EmergencyExportError } from '../domain/errors';
import { formatStorageSize } from '../domain/storage-size';

/** Error de la exportación de emergencia o una falla inesperada (la promesa rechazó). */
export type EmergencyExportProblem = EmergencyExportError | 'unexpected';

/**
 * Mensaje en español, amable y sin tecnicismos, para cada problema de la exportación de
 * emergencia (docs/design/backup.md, 5.5).
 */
export function emergencyExportMessage(problem: EmergencyExportProblem): string {
  if (problem === 'unexpected') {
    return 'No pudimos crear la copia. Vuelve a intentarlo en un momento.';
  }
  switch (problem.code) {
    case 'not_enough_space':
      return `No hay espacio suficiente para la copia. Libera al menos ${formatStorageSize(problem.requiredBytes)} y vuelve a intentarlo.`;
    case 'sharing_unavailable':
      return 'Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo.';
    case 'database_unavailable':
      return 'No pudimos copiar tus datos. Cierra la app y vuelve a intentarlo. No la desinstales: así tus datos se quedan en el teléfono.';
  }
}

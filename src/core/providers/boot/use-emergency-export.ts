import { useCallback, useRef, useState } from 'react';

import type { BootFailure } from '@/core/db/configure-and-migrate';
import { emergencyExportMessage, type EmergencyExportError } from '@/features/backup';
import type { Result } from '@/shared/domain/result';
import type { Logger } from '@/shared/lib/logger';
import type { EmergencyExport, EmergencyExportStatus } from '@/shared/ui';

/** Acción de exportación de emergencia que recibe la puerta de arranque (F8.8). */
export type ExportEmergency = (
  reason: BootFailure['kind'],
) => Promise<Result<void, EmergencyExportError>>;

/**
 * Estado de la exportación de emergencia de la pantalla de error de arranque: `idle`, `working`,
 * `done` o `failed` con su mensaje. Ignora una pulsación mientras otra sigue en curso y deja
 * reintentar tras un problema. Un rechazo inesperado se registra y se muestra amable.
 * Devuelve `undefined` si no hay acción conectada.
 */
export function useEmergencyExport(
  reason: BootFailure['kind'],
  exportEmergency: ExportEmergency | undefined,
  logger: Logger,
): EmergencyExport | undefined {
  const [status, setStatus] = useState<EmergencyExportStatus>({ kind: 'idle' });
  const running = useRef(false);

  const onPress = useCallback(() => {
    if (exportEmergency === undefined || running.current) {
      return;
    }
    running.current = true;
    setStatus({ kind: 'working' });
    exportEmergency(reason)
      .then((result) => {
        setStatus(
          result.ok
            ? { kind: 'done' }
            : { kind: 'failed', message: emergencyExportMessage(result.error) },
        );
      })
      .catch((error: unknown) => {
        logger.error('emergency_export_failed', error, { reason });
        setStatus({ kind: 'failed', message: emergencyExportMessage('unexpected') });
      })
      .finally(() => {
        running.current = false;
      });
  }, [exportEmergency, reason, logger]);

  return exportEmergency === undefined ? undefined : { status, onPress };
}

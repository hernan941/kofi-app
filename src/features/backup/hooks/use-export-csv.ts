import { useCallback, useRef, useState } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { SALE_CHANNEL_LABELS } from '@/features/sales';

import type { ExportProblem } from '../domain/errors';
import { exportProductsCsv, exportSalesCsv } from '../use-cases/export-csv';

/** Planilla que se exporta. */
export type CsvKind = 'sales' | 'products';

/** Estado de "Exportar ventas" y "Exportar productos". */
export type ExportCsvState =
  | { readonly status: 'idle' }
  | { readonly status: 'working'; readonly kind: CsvKind }
  | { readonly status: 'done'; readonly kind: CsvKind }
  | { readonly status: 'failed'; readonly kind: CsvKind; readonly problem: ExportProblem };

/** Lo que devuelve {@link useExportCsv}. */
export interface ExportCsvController {
  readonly state: ExportCsvState;
  /** Exporta la planilla y abre el menú de compartir; no hace nada si ya está trabajando. */
  readonly run: (kind: CsvKind) => Promise<void>;
  /** Vuelve a `idle`. No hace nada mientras está trabajando: la exportación en curso sigue su camino. */
  readonly reset: () => void;
}

/**
 * Estado de la exportación de planillas (F8.1, 3.3): `idle → working(planilla) → done | failed`.
 * Exportar sin datos está permitido (D-44): la planilla sale solo con encabezados.
 */
export function useExportCsv(): ExportCsvController {
  const dependencies = useDependencies();
  const [state, setState] = useState<ExportCsvState>({ status: 'idle' });
  const isRunning = useRef(false);

  const run = useCallback(
    async (kind: CsvKind) => {
      if (isRunning.current) {
        return;
      }
      isRunning.current = true;
      setState({ status: 'working', kind });
      const deps = {
        store: dependencies.backupStore,
        archiveIo: dependencies.archiveIo,
        backupFiles: dependencies.backupFiles,
        fileSharer: dependencies.fileSharer,
      };
      try {
        const result =
          kind === 'sales'
            ? await exportSalesCsv(deps, SALE_CHANNEL_LABELS)
            : await exportProductsCsv(deps);
        setState(
          result.ok ? { status: 'done', kind } : { status: 'failed', kind, problem: result.error },
        );
      } catch (error) {
        dependencies.logger.error('backup_csv_export_failed', error);
        setState({ status: 'failed', kind, problem: 'unexpected' });
      } finally {
        isRunning.current = false;
      }
    },
    [dependencies],
  );

  const reset = useCallback(() => {
    if (isRunning.current) {
      return;
    }
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}

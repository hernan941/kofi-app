import { useRef } from 'react';

import { useAppToast } from '@/shared/ui';

import type { SaleErrors } from '../domain';
import { useMarkNoSales } from '../hooks/use-mark-no-sales';
import { useNoSalesPrompt } from '../hooks/use-no-sales-prompt';
import { useUnmarkNoSales } from '../hooks/use-unmark-no-sales';
import { SALE_ERROR_MESSAGES } from './error-messages';
import { NoSalesPanel, type MarkNoSalesRequest, type UnmarkNoSalesRequest } from './no-sales-panel';

const MARKED_MESSAGES = {
  current: 'Listo, anotamos que esta semana no vendiste.',
  previous: 'Listo, anotamos que la semana pasada no vendiste.',
} as const;

/** Mensaje del primer error del dominio. */
function firstErrorMessage(errors: SaleErrors): string {
  return SALE_ERROR_MESSAGES[errors[0].code];
}

/**
 * "Esta semana no vendí" conectado a los datos (D-37): lee qué ofrecer (`useNoSalesPrompt`),
 * marca y desmarca sin confirmación (se deshace con "Desmarcar") y avisa con un toast. La
 * persona se queda donde está. Mientras carga o si falla no muestra nada: no es la acción
 * principal y el fallo queda en el logger. Un toque repetido mientras guarda se ignora.
 */
export function NoSalesSection() {
  const { prompt } = useNoSalesPrompt();
  const mark = useMarkNoSales();
  const unmark = useUnmarkNoSales();
  const toast = useAppToast();
  const isBusy = useRef(false);

  const run = async (work: () => Promise<void>) => {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      await work();
    } finally {
      isBusy.current = false;
    }
  };

  const handleMark = ({ weekStart, which }: MarkNoSalesRequest) =>
    run(async () => {
      try {
        const result = await mark.mutateAsync({ weekStart });
        if (result.ok) toast.showSuccess(MARKED_MESSAGES[which]);
        else toast.showError(firstErrorMessage(result.error));
      } catch {
        toast.showError('No se pudo marcar. Inténtalo de nuevo.');
      }
    });

  const handleUnmark = ({ weekStart }: UnmarkNoSalesRequest) =>
    run(async () => {
      try {
        const result = await unmark.mutateAsync({ weekStart });
        if (result.ok) toast.showSuccess('Quitamos la marca de esta semana.');
        else toast.showError(firstErrorMessage(result.error));
      } catch {
        toast.showError('No se pudo quitar la marca. Inténtalo de nuevo.');
      }
    });

  if (prompt === null) {
    return null;
  }
  return (
    <NoSalesPanel
      prompt={prompt}
      onMark={(request) => {
        void handleMark(request);
      }}
      onUnmark={(request) => {
        void handleUnmark(request);
      }}
    />
  );
}

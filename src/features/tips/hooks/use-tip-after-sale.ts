import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { loadStreak } from '@/features/sales';
import { weekRangeOf, type SaleRecordId } from '@/shared/domain';

import { hasAnyCostLoaded, pickTipAfterSale, type Tip, type TipContext } from '../domain';
import { tipAfterSaleKeys } from './query-keys';
import { viewsById } from './views-by-id';

/** Datos de la venta recién guardada que decide el consejo. */
export interface AfterSaleTipInput {
  readonly recordId: SaleRecordId;
  readonly isFirstSale: boolean;
}

/**
 * Consejo para la celebración de una venta recién guardada. La elección se calcula una vez
 * por `recordId` y queda congelada: la raíz `tip-after-sale` no depende de ninguna tabla, así
 * que marcar el consejo como visto no provoca otra elección. `data === null` es "sin consejo". Si la elección falla, lo deja en el logger.
 */
export function useTipAfterSale({
  recordId,
  isFirstSale,
}: AfterSaleTipInput): UseQueryResult<Tip | null> {
  const { sales, noSalesWeeks, products, tipViews, tipCatalog, clock, calendar, logger } =
    useDependencies();
  const query = useQuery({
    queryKey: tipAfterSaleKeys.forRecord(recordId),
    queryFn: async () => {
      const record = await sales.findById(recordId);
      if (record === null) {
        return null;
      }
      const currentWeek = weekRangeOf(calendar.localDateOf(clock.now()));
      const [activeProducts, streak, views] = await Promise.all([
        products.listActive(),
        loadStreak({ sales, noSalesWeeks }, currentWeek.start),
        tipViews.listAll(),
      ]);
      const context: TipContext = {
        hasAnyCost: hasAnyCostLoaded(activeProducts),
        isFirstSale,
        channel: record.channel,
        streakWeeks: streak.weeks,
      };
      return pickTipAfterSale(tipCatalog.all(), viewsById(views), context);
    },
  });
  const { isError, error } = query;
  useEffect(() => {
    if (isError) {
      logger.warn('after_sale_tip_failed', { error });
    }
  }, [isError, error, logger]);
  return query;
}

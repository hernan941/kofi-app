import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { addDays, weekRangeOf, type LocalDate, type WeekRange } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';

import { noSalesPrompt, type NoSalesPrompt, type WeekFacts } from '../domain';
import { noSalesKeys, salesKeys } from './query-keys';

const DAYS_IN_WEEK = 7;

/** Estado del panel de "no vendí". */
export interface NoSalesPromptState {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly prompt: NoSalesPrompt | null;
}

function factsOf(
  week: WeekRange,
  saleWeekStarts: readonly LocalDate[],
  markedWeekStarts: ReadonlySet<LocalDate>,
): WeekFacts {
  return {
    week,
    hasSales: saleWeekStarts.includes(week.start),
    isMarked: markedWeekStarts.has(week.start),
  };
}

/**
 * Qué ofrecer en "no vendí": semana actual y anterior (`useToday`) con sus ventas y marcas.
 * Cuando `useToday` cambia (medianoche o vuelta a primer plano) cambian las claves y se recalcula.
 */
export function useNoSalesPrompt(): NoSalesPromptState {
  const { sales, noSalesWeeks } = useDependencies();
  const today = useToday();
  const current = weekRangeOf(today);
  const previous = weekRangeOf(addDays(current.start, -DAYS_IN_WEEK));
  const salesQuery = useQuery({
    queryKey: salesKeys.weekStarts(previous.start, current.end),
    queryFn: () => sales.activeWeekStartsBetween(previous.start, current.end),
  });
  const marksQuery = useQuery({
    queryKey: noSalesKeys.between(previous.start, current.end),
    queryFn: () => noSalesWeeks.listBetween(previous.start, current.end),
  });
  const saleWeekStarts = salesQuery.data;
  const marks = marksQuery.data;
  const prompt = useMemo(() => {
    if (saleWeekStarts === undefined || marks === undefined) {
      return null;
    }
    const marked = new Set(marks.map((mark) => mark.weekStart));
    const currentWeek = weekRangeOf(today);
    const previousWeek = weekRangeOf(addDays(currentWeek.start, -DAYS_IN_WEEK));
    return noSalesPrompt(
      today,
      factsOf(currentWeek, saleWeekStarts, marked),
      factsOf(previousWeek, saleWeekStarts, marked),
    );
  }, [today, saleWeekStarts, marks]);
  return {
    isPending: salesQuery.isPending || marksQuery.isPending,
    isError: salesQuery.isError || marksQuery.isError,
    prompt,
  };
}

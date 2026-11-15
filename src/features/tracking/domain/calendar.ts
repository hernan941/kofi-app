import {
  clpSchema,
  addDays,
  compareYearMonth,
  daysBetween,
  monthGridRange,
  weekRangeOf,
  yearMonthOf,
  type Clp,
  type LocalDate,
  type WeekRange,
  type YearMonth,
} from '@/shared/domain';
import {
  MAX_SALE_TOTAL,
  hasItems,
  recordTotal,
  type NoSalesWeek,
  type SaleRecord,
  type WeekFacts,
} from '@/features/sales/domain';

const DAYS_PER_WEEK = 7;
const LEVEL_STEPS = 3;

/** Lo vendido en un día; solo cuentan los registros con al menos un ítem activo. */
export interface DayActivity {
  readonly date: LocalDate;
  readonly total: Clp;
  readonly recordCount: number;
}

/** Suma por día los registros con ítems; los registros sin ítems no cuentan (ADR-007, regla 15). */
export function dailyActivity(records: readonly SaleRecord[]): ReadonlyMap<LocalDate, DayActivity> {
  const activity = new Map<LocalDate, DayActivity>();
  for (const record of records) {
    if (!hasItems(record)) {
      continue;
    }
    const previous = activity.get(record.soldOn);
    const total = Math.min((previous?.total ?? 0) + recordTotal(record), MAX_SALE_TOTAL);
    activity.set(record.soldOn, {
      date: record.soldOn,
      total: clpSchema.parse(total),
      recordCount: (previous?.recordCount ?? 0) + 1,
    });
  }
  return activity;
}

/** 0 = sin ventas; 1 a 3 = poco, medio y mucho, relativo al día de más monto del mes. */
export type IntensityLevel = 0 | 1 | 2 | 3;

function levelOf(total: number, max: number): 1 | 2 | 3 {
  if (max === 0) {
    return 1;
  }
  const level = Math.ceil((LEVEL_STEPS * total) / max);
  return level <= 1 ? 1 : level === 2 ? 2 : 3;
}

/**
 * Nivel de los días del mes con actividad: `max(1, ceil(3 × total / máximo))`, con el máximo
 * tomado solo de los días del mes (D-41). Con máximo $0 todos son 1. Los días sin actividad y
 * los de otros meses no reciben nivel.
 */
export function intensityLevels(
  activity: ReadonlyMap<LocalDate, DayActivity>,
  month: YearMonth,
): ReadonlyMap<LocalDate, IntensityLevel> {
  const inMonth = [...activity.values()].filter((day) => yearMonthOf(day.date) === month);
  const max = inMonth.reduce((best, day) => Math.max(best, day.total), 0);
  return new Map(inMonth.map((day) => [day.date, levelOf(day.total, max)]));
}

/** Un día de la cuadrícula. Los días de relleno no llevan actividad ni nivel. */
export interface CalendarDay {
  readonly date: LocalDate;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly activity: DayActivity | null;
  readonly level: IntensityLevel;
}

/** Una fila de la cuadrícula, de lunes a domingo. */
export interface CalendarWeek {
  readonly week: WeekRange;
  readonly days: readonly CalendarDay[];
  /** Marca activa de "no vendí" en esta semana. */
  readonly noSalesMarked: boolean;
}

/** El mes listo para dibujar. */
export interface CalendarMonth {
  readonly month: YearMonth;
  readonly weeks: readonly CalendarWeek[];
  /** Total de los días del mes (no de los días de relleno). */
  readonly monthTotal: Clp;
  /** Hay ventas en algún día del mes (no cuentan los días de relleno ni las marcas). */
  readonly hasSales: boolean;
}

/**
 * Arma el mes del calendario con las filas de `monthGridRange`, la actividad y el nivel de
 * cada día, y las semanas marcadas como "no vendí".
 */
export function buildCalendarMonth(
  month: YearMonth,
  today: LocalDate,
  records: readonly SaleRecord[],
  marks: readonly NoSalesWeek[],
): CalendarMonth {
  const range = monthGridRange(month);
  const activity = dailyActivity(records);
  const levels = intensityLevels(activity, month);
  const markedStarts = new Set(marks.map((mark) => mark.weekStart));
  const weekCount = (daysBetween(range.start, range.end) + 1) / DAYS_PER_WEEK;
  const toDay = (date: LocalDate): CalendarDay => {
    const inMonth = yearMonthOf(date) === month;
    return {
      date,
      inMonth,
      isToday: date === today,
      isFuture: date > today,
      activity: inMonth ? (activity.get(date) ?? null) : null,
      level: levels.get(date) ?? 0,
    };
  };
  const weeks = Array.from({ length: weekCount }, (_, index): CalendarWeek => {
    const week = weekRangeOf(addDays(range.start, index * DAYS_PER_WEEK));
    return {
      week,
      days: Array.from({ length: DAYS_PER_WEEK }, (_unused, offset) =>
        toDay(addDays(week.start, offset)),
      ),
      noSalesMarked: markedStarts.has(week.start),
    };
  });
  const monthActivity = [...activity.values()].filter((day) => yearMonthOf(day.date) === month);
  const monthTotal = monthActivity.reduce((sum, day) => sum + day.total, 0);
  return {
    month,
    weeks,
    monthTotal: clpSchema.parse(Math.min(monthTotal, MAX_SALE_TOTAL)),
    hasSales: monthActivity.length > 0,
  };
}

/**
 * Mes más antiguo al que se puede navegar hacia atrás: el menor entre el de la primera venta
 * y el del lunes de la semana pasada, para ver siempre las dos semanas que admiten "no vendí"
 * (D-18).
 */
export function calendarNavigationLimit(
  today: LocalDate,
  earliestSale: YearMonth | null,
): YearMonth {
  const previousWeekStart = addDays(weekRangeOf(today).start, -DAYS_PER_WEEK);
  const previousWeekMonth = yearMonthOf(previousWeekStart);
  return earliestSale !== null && compareYearMonth(earliestSale, previousWeekMonth) < 0
    ? earliestSale
    : previousWeekMonth;
}

/** `WeekFacts` de F3 a partir de los datos ya cargados ("tiene ventas" = `hasItems`). */
export function weekFactsOf(
  week: WeekRange,
  records: readonly SaleRecord[],
  marks: readonly NoSalesWeek[],
): WeekFacts {
  return {
    week,
    hasSales: records.some(
      (record) => record.soldOn >= week.start && record.soldOn <= week.end && hasItems(record),
    ),
    isMarked: marks.some((mark) => mark.weekStart === week.start),
  };
}

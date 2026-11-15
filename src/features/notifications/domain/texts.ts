import { addMonths, monthName, type YearMonth } from '@/shared/domain';

import type { NotificationContent, WeeklyReminderVariant } from './plan';

const WEEKLY_TEXTS: Readonly<Record<WeeklyReminderVariant, { title: string; body: string }>> = {
  neutral: {
    title: '¿Anotamos tus ventas de la semana?',
    body: 'Si esta semana no vendiste, también puedes marcarlo.',
  },
  already_registered: {
    title: 'Tu semana ya está anotada',
    body: 'Si hubo alguna venta nueva, puedes sumarla en un momento.',
  },
};

const MONTHLY_BODY = 'Toca para ver cómo fue tu mes.';

/** Texto del recordatorio semanal; `neutral` no menciona datos de la semana (D-13). */
export function weeklyReminderContent(variant: WeeklyReminderVariant): NotificationContent {
  return { ...WEEKLY_TEXTS[variant], deepLink: '/sales/new' };
}

/** Texto del resumen mensual del mes que se resume (sin año, en minúscula). */
export function monthlySummaryContent(summarizedMonth: YearMonth): NotificationContent {
  return {
    title: `Tu resumen de ${monthName(Number(summarizedMonth.slice(5, 7)))} está listo`,
    body: MONTHLY_BODY,
    deepLink: '/tracking/monthly',
    month: summarizedMonth,
  };
}

/** Mes que resume el aviso que se dispara en `fireMonth`: el anterior. */
export function summarizedMonthOf(fireMonth: YearMonth): YearMonth {
  return addMonths(fireMonth, -1);
}

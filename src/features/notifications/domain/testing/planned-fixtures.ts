import { epochMsSchema, yearMonthSchema } from '@/shared/domain';

import type { PlannedNotification, WeeklyReminderVariant } from '../plan';
import { monthlySummaryContent, weeklyReminderContent } from '../texts';

/** Epoch branded value for fixtures. */
export const epochAt = (value: number) => epochMsSchema.parse(value);

/** One-off weekly reminder, as the plan builds it. */
export function plannedWeeklyOnce(
  identifier: string,
  fireAt: number,
  variant: WeeklyReminderVariant = 'neutral',
): PlannedNotification {
  return {
    identifier,
    kind: 'weekly_reminder',
    trigger: { type: 'once', fireAt: epochAt(fireAt) },
    content: weeklyReminderContent(variant),
  };
}

/** `cv.weekly.repeat` on Sundays at 20:00. */
export function plannedWeeklyRepeat(): PlannedNotification {
  return {
    identifier: 'cv.weekly.repeat',
    kind: 'weekly_reminder',
    trigger: { type: 'weekly', weekday: 7, minuteOfDay: 1200 },
    content: weeklyReminderContent('neutral'),
  };
}

/** Monthly summary that fires on `fireMonth` and summarizes `summarizedMonth`. */
export function plannedMonthly(
  fireMonth: string,
  summarizedMonth: string,
  fireAt = 1_000,
): PlannedNotification {
  return {
    identifier: `cv.monthly.${fireMonth}`,
    kind: 'monthly_summary',
    trigger: { type: 'once', fireAt: epochAt(fireAt) },
    content: monthlySummaryContent(yearMonthSchema.parse(summarizedMonth)),
  };
}

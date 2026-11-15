import { epochMsSchema, type EpochMs } from '@/shared/domain';

import { TEST_NOTIFICATION_PREFIX } from './identifiers';
import type { PlannedNotification, WeeklyReminderVariant } from './plan';
import { weeklyReminderContent } from './texts';

const MS_PER_SECOND = 1000;

interface TestStep {
  readonly variant: WeeklyReminderVariant;
  readonly offsetSeconds: number;
}

/** Avisos del estado B: el adaptado en 1 minuto y dos neutros a los 3 y 5 minutos. */
const SEQUENCE_STEPS: readonly TestStep[] = [
  { variant: 'already_registered', offsetSeconds: 60 },
  { variant: 'neutral', offsetSeconds: 180 },
  { variant: 'neutral', offsetSeconds: 300 },
];

const SINGLE_ID = `${TEST_NOTIFICATION_PREFIX}single`;
const sequenceId = (position: number): string =>
  `${TEST_NOTIFICATION_PREFIX}seq.${String(position)}`;

/** Todos los ids que puede tener una tanda de prueba; son fijos, así que una tanda nueva reemplaza a la anterior. */
export const TEST_NOTIFICATION_IDS: readonly string[] = [
  SINGLE_ID,
  ...SEQUENCE_STEPS.map((_step, index) => sequenceId(index + 1)),
];

/** Aviso de prueba con el mismo payload que el real, para que tocarlo lleve al mismo destino. */
function testNotification(
  identifier: string,
  now: EpochMs,
  { variant, offsetSeconds }: TestStep,
): PlannedNotification {
  return {
    identifier,
    kind: 'weekly_reminder',
    trigger: { type: 'once', fireAt: epochMsSchema.parse(now + offsetSeconds * MS_PER_SECOND) },
    content: weeklyReminderContent(variant),
  };
}

/** El aviso `cvtest.single` en 1 minuto con el texto de `variant`. */
export function planTestReminder(input: {
  readonly now: EpochMs;
  readonly variant: WeeklyReminderVariant;
}): readonly PlannedNotification[] {
  return [testNotification(SINGLE_ID, input.now, { variant: input.variant, offsetSeconds: 60 })];
}

/** La secuencia `cvtest.seq.<n>` que imita el estado B, en 1, 3 y 5 minutos. */
export function planTestSequence(input: { readonly now: EpochMs }): readonly PlannedNotification[] {
  return SEQUENCE_STEPS.map((step, index) =>
    testNotification(sequenceId(index + 1), input.now, step),
  );
}

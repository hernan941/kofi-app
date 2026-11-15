import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';

import type { IsoWeekday } from '@/shared/domain';
import { ChipGroup, QuantityStepper, announce, type ChipOption } from '@/shared/ui';

import { formatReminderTime, weekdayPlural } from './notification-texts';

const MINUTES_PER_HOUR = 60;
const LAST_HOUR = 23;

const DAY_OPTIONS: readonly ChipOption<string>[] = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
];

const MINUTE_OPTIONS: readonly ChipOption<string>[] = ['00', '15', '30', '45'].map((value) => ({
  value,
  label: value,
}));

/** Día y minuto del día del recordatorio semanal. */
export interface WeeklyReminderValue {
  readonly weekday: IsoWeekday;
  readonly minuteOfDay: number;
}

/** Props of {@link WeeklyReminderFields}. */
export interface WeeklyReminderFieldsProps {
  readonly value: WeeklyReminderValue;
  readonly onChange: (value: WeeklyReminderValue) => void;
}

const SUMMARY_ANNOUNCE_DELAY_MS = 700;

/** La hora como la lee el lector de pantalla: "1 hora", "8 horas". */
function hourText(hour: number): string {
  return hour === 1 ? '1 hora' : `${String(hour)} horas`;
}

/** Texto "Te avisamos los martes a las 8:30." */
export function weeklyReminderSummary({ weekday, minuteOfDay }: WeeklyReminderValue): string {
  return `Te avisamos ${weekdayPlural(weekday)} a las ${formatReminderTime(minuteOfDay)}.`;
}

/**
 * Contenido controlado de la hoja "Día y hora": día (chips de lunes a domingo), hora (0 a 23,
 * se puede escribir), minutos (00, 15, 30 y 45) y el resumen, que se anuncia con `announce` solo cuando cambia (no al abrir) y con un pequeño retraso, para
 * que el lector termine de decir el chip elegido antes de leer el resumen. Si
 * el minuto guardado no es uno de los cuatro, ningún chip aparece elegido.
 */
export function WeeklyReminderFields({ value, onChange }: WeeklyReminderFieldsProps) {
  const hour = Math.floor(value.minuteOfDay / MINUTES_PER_HOUR);
  const minutes = value.minuteOfDay % MINUTES_PER_HOUR;
  const minuteValue = String(minutes).padStart(2, '0');
  const summary = weeklyReminderSummary(value);

  const announced = useRef(summary);

  useEffect(() => {
    if (announced.current === summary) return undefined;
    announced.current = summary;
    const timer = setTimeout(() => {
      announce(summary);
    }, SUMMARY_ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [summary]);

  return (
    <View className="gap-6">
      <ChipGroup
        label="Día"
        options={DAY_OPTIONS}
        value={String(value.weekday)}
        onChange={(next) => {
          onChange({ ...value, weekday: Number(next) as IsoWeekday });
        }}
      />
      <QuantityStepper
        label="Hora"
        min={0}
        max={LAST_HOUR}
        value={hour}
        valueText={hourText(hour)}
        onChange={(next) => {
          onChange({ ...value, minuteOfDay: next * MINUTES_PER_HOUR + minutes });
        }}
      />
      <ChipGroup
        label="Minutos"
        options={MINUTE_OPTIONS}
        value={MINUTE_OPTIONS.some((option) => option.value === minuteValue) ? minuteValue : null}
        onChange={(next) => {
          onChange({ ...value, minuteOfDay: hour * MINUTES_PER_HOUR + Number(next) });
        }}
      />
      <Text className="text-base text-foreground">{summary}</Text>
    </View>
  );
}

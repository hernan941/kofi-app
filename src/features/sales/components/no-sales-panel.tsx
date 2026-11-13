import { useState } from 'react';
import { Text, View } from 'react-native';

import type { LocalDate, WeekRange } from '@/shared/domain';
import { CheckCircleIcon, ChipGroup, InlineNotice, SecondaryButton, TextButton } from '@/shared/ui';

import type { NoSalesPrompt } from '../domain';
import { describeWeekRange, describeWeekStart } from './week-range-label';

/** Qué semana se marcó: la actual o la anterior. */
export type NoSalesWhich = 'current' | 'previous';

/** Pedido de marcar una semana como "no vendí". */
export interface MarkNoSalesRequest {
  readonly weekStart: LocalDate;
  readonly which: NoSalesWhich;
}

/** Pedido de quitar la marca de una semana. */
export interface UnmarkNoSalesRequest {
  readonly weekStart: LocalDate;
}

/** Props of {@link NoSalesPanel}. */
export interface NoSalesPanelProps {
  readonly prompt: NoSalesPrompt;
  readonly onMark: (request: MarkNoSalesRequest) => void;
  readonly onUnmark: (request: UnmarkNoSalesRequest) => void;
}

const WEEK_OPTIONS = [
  { value: 'previous', label: 'La semana pasada' },
  { value: 'current', label: 'Esta semana' },
] as const;

/** Dos semanas para elegir (lunes o martes), con la anterior preseleccionada. */
function ChooseWeek({
  previous,
  current,
  onMark,
}: {
  readonly previous: WeekRange;
  readonly current: WeekRange;
  readonly onMark: NoSalesPanelProps['onMark'];
}) {
  const [which, setWhich] = useState<NoSalesWhich>('previous');
  const week = which === 'previous' ? previous : current;
  return (
    <>
      <Text className="text-sm text-muted">¿No vendiste nada? Elige la semana.</Text>
      <ChipGroup label="Semana" options={WEEK_OPTIONS} value={which} onChange={setWhich} />
      <Text className="text-sm text-muted">
        {which === 'previous' ? describeWeekRange(week) : describeWeekStart(week)}
      </Text>
      <SecondaryButton
        label="Marcar que no vendí"
        onPress={() => {
          onMark({ weekStart: week.start, which });
        }}
      />
    </>
  );
}

/**
 * Panel de "esta semana no vendí" (D-37, D-18, D-25) sin tarjeta, para no competir con
 * "Guardar venta". Presenta uno de los cuatro `NoSalesPrompt` que decide el dominio: marcar
 * la semana (o elegir cuál), mostrar la marca con "Desmarcar", o explicar con amabilidad que
 * una semana con ventas no necesita la marca. Solo avisa lo que se pidió; guardar y los
 * avisos son de quien lo usa.
 */
export function NoSalesPanel({ prompt, onMark, onUnmark }: NoSalesPanelProps) {
  switch (prompt.kind) {
    case 'single': {
      const isCurrent = prompt.which === 'current';
      return (
        <View className="gap-2">
          <Text className="text-sm text-muted">
            {isCurrent
              ? '¿No vendiste nada esta semana? Anotarlo también cuenta.'
              : `¿No vendiste nada la semana pasada (${describeWeekRange(prompt.week)})? Anotarlo también cuenta.`}
          </Text>
          <SecondaryButton
            label={isCurrent ? 'Esta semana no vendí' : 'La semana pasada no vendí'}
            onPress={() => {
              onMark({ weekStart: prompt.week.start, which: prompt.which });
            }}
          />
        </View>
      );
    }
    case 'choose':
      return (
        <View className="gap-2">
          <ChooseWeek previous={prompt.previous} current={prompt.current} onMark={onMark} />
        </View>
      );
    case 'marked':
      return (
        <View className="gap-2">
          <InlineNotice message="Marcaste que esta semana no vendiste." icon={CheckCircleIcon} />
          <View className="items-start">
            <TextButton
              label="Desmarcar"
              accessibilityHint="Quita la marca de esta semana"
              onPress={() => {
                onUnmark({ weekStart: prompt.week.start });
              }}
            />
          </View>
        </View>
      );
    case 'has_sales':
      return (
        <View className="gap-2">
          <InlineNotice message='Esta semana ya tiene ventas, así que no hace falta marcar "no vendí".' />
        </View>
      );
  }
}

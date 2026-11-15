import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';

import { formatClpAccessible, isoWeekStart, type Clp, type LocalDate } from '@/shared/domain';
import {
  Amount,
  ConfettiIcon,
  Icon,
  InfoIcon,
  InlineNotice,
  PrimaryButton,
  formatDateLabel,
  type ButtonHandle,
  StyledSafeAreaView,
} from '@/shared/ui';

import { useScheduleFrame } from '@/shared/lib/use-schedule-frame';
import type { SaleSavedOutcome } from '../use-cases/save-sale-record';

/** Lo que la celebración le da a lo que se dibuja en su lugar reservado. */
export interface AfterSaveControls {
  /** Lleva el foco de accesibilidad al botón "Listo" (por ejemplo, al cerrar un consejo). */
  readonly focusDone: () => void;
}

/** Props of {@link SaleSavedCelebration}. */
export interface SaleSavedCelebrationProps {
  readonly outcome: SaleSavedOutcome;
  readonly total: Clp;
  /** Suma de las cantidades de la venta. */
  readonly productCount: number;
  readonly today: LocalDate;
  readonly onDone: () => void;
  /** Punto de extensión de F6: lo que devuelve se dibuja en el lugar reservado del consejo. */
  readonly renderAfterSave?: (outcome: SaleSavedOutcome, controls: AfterSaveControls) => ReactNode;
}

const ICON_ENTRANCE = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(200);

/** Texto del resumen: "Hoy, viernes 13 de noviembre · 3 productos". */
function summaryText(soldOn: LocalDate, today: LocalDate, productCount: number): string {
  const noun = productCount === 1 ? '1 producto' : `${String(productCount)} productos`;
  return `${formatDateLabel(soldOn, today)} · ${noun}`;
}

/** Aviso suave de D-02: se quitó la marca de "no vendí" de la semana de la venta. */
function clearedNoticeText(clearedWeek: LocalDate, today: LocalDate): string {
  const which = clearedWeek === isoWeekStart(today) ? 'esta semana' : 'esa semana';
  return `Como vendiste ${which}, quitamos la marca de "no vendí".`;
}

/** Foco de accesibilidad en un elemento, en el siguiente cuadro, cuando ya está dibujado. */
function focusElement(
  scheduleFrame: ReturnType<typeof useScheduleFrame>,
  element: Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0] | null,
) {
  scheduleFrame(() => {
    if (element !== null) AccessibilityInfo.sendAccessibilityEvent(element, 'focus');
  });
}

/**
 * Confirmación que celebra (D-36, UX-S9): ícono de confeti, título (el de la primera venta es
 * propio), el total en grande, el resumen, una frase y, si se quitó una marca de "no vendí",
 * el aviso suave de D-02. Deja un lugar reservado (`renderAfterSave`) para el consejo de F6 y
 * un único camino de salida, "Listo", para que el consejo y el pedido de permiso nunca se
 * salten. Al aparecer lleva el foco al título, que dice también el total. El ícono entra con un
 * fundido y escala suaves, salvo que el sistema pida reducir el movimiento. No anuncia aparte: el foco va al título, que
 * ya incluye el total ("¡Venta registrada! 45.000 pesos"), así se oye una sola vez.
 */
export function SaleSavedCelebration({
  outcome,
  total,
  productCount,
  today,
  onDone,
  renderAfterSave,
}: SaleSavedCelebrationProps) {
  const isReducedMotion = useReducedMotion();
  const title = useRef<ComponentRef<typeof Text>>(null);
  const [doneButton, setDoneButton] = useState<ButtonHandle | null>(null);
  const { isFirstSale, clearedNoSalesWeek } = outcome;
  const titleText = isFirstSale ? '¡Registraste tu primera venta!' : '¡Venta registrada!';

  const scheduleFrame = useScheduleFrame();
  useEffect(() => {
    focusElement(scheduleFrame, title.current);
  }, [scheduleFrame]);

  const controls: AfterSaveControls = {
    focusDone: () => {
      focusElement(scheduleFrame, doneButton);
    },
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="items-center gap-4 px-4 pt-12 pb-6">
        <Animated.View entering={isReducedMotion ? undefined : ICON_ENTRANCE}>
          <Icon icon={ConfettiIcon} size="xl" weight="duotone" color="accent" />
        </Animated.View>
        <Text
          ref={title}
          accessibilityRole="header"
          accessibilityLabel={`${titleText} ${formatClpAccessible(total)}`}
          className="text-center font-semibold text-title text-foreground"
        >
          {titleText}
        </Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Amount value={total} variant="display" />
        </View>
        <Text className="text-center text-base text-muted">
          {summaryText(outcome.soldOn, today, productCount)}
        </Text>
        <Text className="text-center text-base text-foreground">
          {isFirstSale
            ? 'Así empieza tu historial. Cada venta que anotas te ayuda a ver tu ritmo.'
            : 'Ya quedó en tu historial.'}
        </Text>
        {clearedNoSalesWeek === null ? null : (
          <InlineNotice message={clearedNoticeText(clearedNoSalesWeek, today)} icon={InfoIcon} />
        )}
        {renderAfterSave?.(outcome, controls)}
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="px-4 pt-2 pb-4">
        <PrimaryButton ref={setDoneButton} label="Listo" onPress={onDone} />
      </StyledSafeAreaView>
    </View>
  );
}

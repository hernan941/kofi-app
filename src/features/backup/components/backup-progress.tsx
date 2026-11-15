import type { ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Spinner, useThemeColor } from 'heroui-native';

import { CheckCircleIcon, CircleIcon, Icon, ProgressBlock, useAnnounceWhen } from '@/shared/ui';

import type { RestoreProgress } from '../domain/progress';
import type { RestoreSource } from '../hooks/restore-flow';
import { formatCount, RESTORE_STEP_LABELS } from './backup-messages';
import { restoreStepStates, type RestoreStep, type RestoreStepState } from './restore-steps';

type IconGlyph = ComponentProps<typeof Icon>['icon'];

/** Props of {@link BackupProgress}. */
export interface BackupProgressProps {
  readonly progress: RestoreProgress | null;
  readonly hasPhotos: boolean;
  readonly source: RestoreSource;
}

function barOf(
  step: RestoreStep,
  progress: RestoreProgress | null,
): { done: number; total: number } | undefined {
  if (progress?.phase === 'safety_backup' && step === 'safety') {
    return { done: progress.done, total: progress.total };
  }
  if (progress?.phase === 'copying_photos' && step === 'photos') {
    return { done: progress.done, total: progress.total };
  }
  return undefined;
}

function StepMarker({ state }: { readonly state: RestoreStepState }) {
  const accent = useThemeColor('accent');
  if (state === 'current') {
    return (
      <View
        testID="step-marker-spinner"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Spinner size="sm" color={accent} />
      </View>
    );
  }
  const icon: IconGlyph = state === 'done' ? CheckCircleIcon : CircleIcon;
  return (
    <Icon
      icon={icon}
      color={state === 'done' ? 'accent' : 'muted'}
      weight={state === 'done' ? 'fill' : 'bold'}
    />
  );
}

function stepLabel(label: string, state: RestoreStepState): string {
  if (state === 'done') return `${label}, hecho`;
  if (state === 'pending') return `${label}, pendiente`;
  return label;
}

function StepRow({
  step,
  state,
  progress,
}: {
  readonly step: RestoreStep;
  readonly state: RestoreStepState;
  readonly progress: RestoreProgress | null;
}) {
  const label = RESTORE_STEP_LABELS[step];
  const bar = barOf(step, progress);
  const isPhotos = step === 'photos';
  const photosText =
    bar === undefined ? label : `${formatCount(bar.done)} de ${formatCount(bar.total)} fotos`;

  return (
    <View
      accessible={state !== 'current'}
      accessibilityLabel={stepLabel(label, state)}
      className="min-h-12 flex-row items-start gap-3 py-2"
    >
      <StepMarker state={state} />
      <View className="flex-1 gap-2">
        {state === 'current' ? (
          <>
            {isPhotos ? (
              <Text className="font-semibold text-base text-foreground">{label}</Text>
            ) : null}
            <ProgressBlock
              label={isPhotos ? photosText : label}
              progress={bar}
              valueText={isPhotos ? photosText : undefined}
            />
          </>
        ) : (
          <Text className={`text-base ${state === 'done' ? 'text-foreground' : 'text-muted'}`}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Progreso de una restauración (F8.1, 3.6): título, la frase de tranquilidad y la lista de
 * pasos. Cada paso se distingue por su ícono y el peso del texto, no solo por el color. Anuncia
 * el texto de cada paso al empezar (nunca cada foto); la barra del paso en curso es un
 * `progressbar` con su valor accesible.
 */
export function BackupProgress({ progress, hasPhotos, source }: BackupProgressProps) {
  const steps = restoreStepStates(progress, hasPhotos);
  const current = steps.find(({ state }) => state === 'current');
  useAnnounceWhen(current === undefined ? undefined : RESTORE_STEP_LABELS[current.step]);
  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pt-8 pb-8">
      <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
        {source === 'safety' ? 'Volviendo a la copia de seguridad' : 'Restaurando tu respaldo'}
      </Text>
      <Text className="text-base text-muted">
        Puede tardar un poco si tienes muchas fotos. Si la app se cierra antes de terminar, tus
        datos se quedan como estaban.
      </Text>
      <View>
        {steps.map(({ step, state }) => (
          <StepRow key={step} step={step} state={state} progress={progress} />
        ))}
      </View>
    </ScrollView>
  );
}

import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  CheckCircleIcon,
  Icon,
  PrimaryButton,
  SecondaryButton,
  WarningCircleIcon,
  announce,
  StyledSafeAreaView,
} from '@/shared/ui';

import { backupDateOf, type BackupDate } from '../domain/backup-date';
import type { RestoreSource } from '../hooks/restore-flow';
import type { RestoreProblem } from '../domain/errors';
import { restoreProblemMessage } from './backup-messages';
import { useFocusOnAppear } from './use-focus-on-appear';

/** Props of {@link RestoreSuccess}. */
export interface RestoreSuccessProps {
  readonly source: RestoreSource;
  readonly date: BackupDate;
  readonly onGoHome: () => void;
}

/**
 * Éxito de una restauración (F8.1, 3.7, D-44): título, qué tiene ahora la app, dónde quedó lo
 * anterior y "Ir al inicio". Al aparecer anuncia "Restauramos tu respaldo." y lleva el foco al
 * título.
 */
export function RestoreSuccess({ source, date, onGoHome }: RestoreSuccessProps) {
  const title = useFocusOnAppear();
  useEffect(() => {
    announce('Restauramos tu respaldo.');
  }, []);
  const isSafety = source === 'safety';
  const from = `${isSafety ? 'de la copia' : 'del respaldo'} ${backupDateOf(date)}`;
  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="items-center gap-4 px-4 pt-12 pb-6">
        <Icon icon={CheckCircleIcon} size="xl" weight="fill" color="accent" />
        <Text
          ref={title}
          accessibilityRole="header"
          className="text-center font-semibold text-title text-foreground"
        >
          {isSafety ? 'Listo, volviste a la copia de seguridad' : 'Listo, restauramos tu respaldo'}
        </Text>
        <Text className="text-center text-base text-foreground">
          {`Ahora la app tiene los productos y las ventas ${from}.`}
        </Text>
        <Text className="text-center text-base text-muted">
          {
            'Cómo estaba la app antes quedó guardado en "Copia de seguridad", en esta misma pantalla.'
          }
        </Text>
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="px-4 pt-2 pb-4">
        <PrimaryButton label="Ir al inicio" onPress={onGoHome} />
      </StyledSafeAreaView>
    </View>
  );
}

/** Props of {@link RestoreFailure}. */
export interface RestoreFailureProps {
  readonly problem: RestoreProblem;
  readonly source: RestoreSource;
  /** Si el problema llegó después de confirmar, se agrega que los datos siguen como estaban. */
  readonly afterConfirm: boolean;
  readonly onBack: () => void;
  readonly onPickAnother: () => void;
}

/**
 * Vista de problema (F8.1, 3.9): título y frase propios de cada problema, sin palabras técnicas.
 * Ofrece "Elegir otro archivo" solo si el problema es del archivo y no viene de la copia de
 * seguridad. Al aparecer anuncia el título y lleva el foco a él.
 */
export function RestoreFailure({
  problem,
  source,
  afterConfirm,
  onBack,
  onPickAnother,
}: RestoreFailureProps) {
  const title = useFocusOnAppear();
  const message = restoreProblemMessage(problem);
  useEffect(() => {
    announce(message.title);
  }, [message.title]);
  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="items-center gap-4 px-4 pt-12 pb-6">
        <Icon icon={WarningCircleIcon} size="xl" color="danger" />
        <Text
          ref={title}
          accessibilityRole="header"
          className="text-center font-semibold text-heading text-foreground"
        >
          {message.title}
        </Text>
        <Text className="text-center text-base text-foreground">{message.message}</Text>
        {afterConfirm ? (
          <Text className="text-center text-base text-muted">Tus datos siguen como estaban.</Text>
        ) : null}
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="gap-2 px-4 pt-2 pb-4">
        <PrimaryButton label="Volver" onPress={onBack} />
        {message.offersAnotherFile && source === 'file' ? (
          <SecondaryButton label="Elegir otro archivo" onPress={onPickAnother} />
        ) : null}
      </StyledSafeAreaView>
    </View>
  );
}

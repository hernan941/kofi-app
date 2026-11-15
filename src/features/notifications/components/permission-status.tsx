import { Text } from 'react-native';

import { CheckCircleIcon, Card, InlineNotice, PrimaryButton } from '@/shared/ui';

import type { NotificationPermission } from '../domain/ports';

/** Props of {@link PermissionStatus}. */
export interface PermissionStatusProps {
  /** `undefined` mientras se lee: no se dibuja nada, para que no aparezca y desaparezca una tarjeta. */
  readonly permission: NotificationPermission | undefined;
  /** Pide el permiso directo (diálogo del sistema), sin pantalla explicativa. */
  readonly onRequest: () => void;
  /** Lleva a los ajustes del teléfono; la app no vuelve a pedir el permiso denegado. */
  readonly onOpenSettings: () => void;
}

/** Estado del permiso de avisos al tope de Recordatorios (F7.1, 3.3). */
export function PermissionStatus({ permission, onRequest, onOpenSettings }: PermissionStatusProps) {
  if (permission === 'undetermined') {
    return (
      <Card title="Activa los avisos">
        <Text className="text-base text-foreground">
          Para que te lleguen los recordatorios, cuantovendi necesita tu permiso para enviarte
          avisos.
        </Text>
        <PrimaryButton label="Activar recordatorios" onPress={onRequest} />
      </Card>
    );
  }
  if (permission === 'denied') {
    return (
      <Card title="Los avisos están apagados">
        <Text className="text-base text-foreground">
          Están desactivados en los ajustes de tu teléfono. Si quieres recibirlos, actívalos ahí.
        </Text>
        <PrimaryButton
          label="Abrir ajustes"
          accessibilityHint="Abre los ajustes de cuantovendi en tu teléfono"
          onPress={onOpenSettings}
        />
      </Card>
    );
  }
  if (permission === 'granted') {
    return (
      <InlineNotice message="Los avisos están activados en tu teléfono." icon={CheckCircleIcon} />
    );
  }
  return null;
}

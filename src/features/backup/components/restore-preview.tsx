import { useState, type ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  BellIcon,
  Card,
  ClockCounterClockwiseIcon,
  AccessibleGroup,
  ConfirmDialog,
  DeleteButton,
  Icon,
  InlineNotice,
  ListRow,
  ListSeparator,
  ShieldCheckIcon,
  TextButton,
  StyledSafeAreaView,
} from '@/shared/ui';

import { backupDateOf, type BackupDate } from '../domain/backup-date';
import type { RestoreSource } from '../hooks/restore-flow';
import type { RestorePreview as RestorePreviewData } from '../use-cases/prepare-restore';
import { currentCountsSentence, formatCount, previewCardLabel } from './backup-messages';
import { useFocusOnAppear } from './use-focus-on-appear';

type IconGlyph = ComponentProps<typeof Icon>['icon'];

/** Props of {@link RestorePreview}. */
export interface RestorePreviewProps {
  readonly preview: RestorePreviewData;
  readonly source: RestoreSource;
  readonly date: BackupDate;
  /** Fecha de la copia de seguridad que esta restauración reemplaza (D-22), si hay una. */
  readonly previousSafetyDate: BackupDate | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

interface Texts {
  readonly title: string;
  readonly cardTitle: string;
  readonly safetyLine: string;
  readonly dialogDescription: string;
}

function textsFor(source: RestoreSource, date: BackupDate): Texts {
  const when = backupDateOf(date);
  if (source === 'safety') {
    return {
      title: '¿Volver a la copia de seguridad?',
      cardTitle: `Copia ${when}`,
      safetyLine:
        'Antes de empezar, guardamos cómo está la app ahora. Esa pasa a ser tu nueva copia de seguridad.',
      dialogDescription: `Lo que hay ahora en la app se cambia por la copia ${when}.`,
    };
  }
  return {
    title: '¿Restaurar este respaldo?',
    cardTitle: `Respaldo ${when}`,
    safetyLine: 'Antes de empezar, guardamos una copia de seguridad de cómo está la app ahora.',
    dialogDescription: `Lo que hay ahora en la app se cambia por el respaldo ${when}. Antes guardamos una copia de seguridad.`,
  };
}

function CountRow({ title, count }: { readonly title: string; readonly count: number }) {
  return (
    <ListRow
      title={title}
      trailing={<Text className="font-bold text-lg text-foreground">{formatCount(count)}</Text>}
    />
  );
}

function WillHappen({
  icon,
  children,
}: {
  readonly icon: IconGlyph;
  readonly children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Icon icon={icon} size="md" color="muted" />
      <View className="flex-1 gap-1">{children}</View>
    </View>
  );
}

/**
 * Vista previa de una restauración (F8.1, 3.5): qué trae el respaldo y qué hay hoy en la app
 * (D-45), qué se va a reemplazar, que antes se guarda una copia de seguridad (D-22) y que los
 * recordatorios no cambian (D-28). Restaurar reemplaza todo, así que "Reemplazar mis datos" no
 * es el botón principal y pide una segunda confirmación explícita.
 */
export function RestorePreview({
  preview,
  source,
  date,
  previousSafetyDate,
  onConfirm,
  onCancel,
}: RestorePreviewProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const title = useFocusOnAppear();
  const texts = textsFor(source, date);
  const isEmpty = preview.products === 0 && preview.saleRecords === 0;

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-6 px-4 pt-4 pb-6">
        <Text
          ref={title}
          accessibilityRole="header"
          className="font-semibold text-title text-foreground"
        >
          {texts.title}
        </Text>
        <AccessibleGroup label={previewCardLabel(texts.cardTitle, preview)}>
          <Card title={texts.cardTitle}>
            <CountRow title="Productos" count={preview.products} />
            <ListSeparator />
            <CountRow title="Ventas" count={preview.saleRecords} />
            <ListSeparator />
            <CountRow title="Fotos" count={preview.activePhotos} />
          </Card>
        </AccessibleGroup>
        <Text className="text-base text-muted">{currentCountsSentence(preview.current)}</Text>
        {isEmpty ? (
          <InlineNotice message="Este respaldo no tiene productos ni ventas. Si lo restauras, la app queda vacía." />
        ) : null}
        <View className="gap-3">
          <WillHappen icon={ClockCounterClockwiseIcon}>
            <Text className="text-base text-foreground">
              Todo lo que hay ahora en la app se cambia por lo que tiene este respaldo: productos,
              fotos y ventas.
            </Text>
          </WillHappen>
          <WillHappen icon={ShieldCheckIcon}>
            <Text className="text-base text-foreground">{texts.safetyLine}</Text>
            {previousSafetyDate === null || source === 'safety' ? null : (
              <Text className="text-base text-foreground">
                {`Reemplaza a la copia ${backupDateOf(previousSafetyDate)}.`}
              </Text>
            )}
          </WillHappen>
          <WillHappen icon={BellIcon}>
            <Text className="text-base text-foreground">
              Tus recordatorios se mantienen como están.
            </Text>
          </WillHappen>
        </View>
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="gap-2 px-4 pt-2 pb-4">
        <DeleteButton
          label="Reemplazar mis datos"
          onPress={() => {
            setIsConfirming(true);
          }}
        />
        <TextButton label="Cancelar" onPress={onCancel} />
      </StyledSafeAreaView>
      <ConfirmDialog
        isOpen={isConfirming}
        title="¿Reemplazar todos tus datos?"
        description={texts.dialogDescription}
        confirmLabel="Sí, reemplazar"
        isDestructive
        onConfirm={() => {
          setIsConfirming(false);
          onConfirm();
        }}
        onCancel={() => {
          setIsConfirming(false);
        }}
      />
    </View>
  );
}

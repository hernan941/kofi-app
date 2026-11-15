import { ScrollView } from 'react-native';

import { reminderSummaryText, useReminderSummary } from '@/features/notifications';
import {
  Card,
  CaretRightIcon,
  Icon,
  ListRow,
  ListSeparator,
  Screen,
  ScreenHeader,
} from '@/shared/ui';

import { PrivacyNote } from '../components/privacy-note';
import { SettingsSection } from '../components/settings-section';
import { SETTINGS_TEXTS, backupSummaryText, versionText } from '../components/settings-texts';
import { useAppVersion } from '../hooks/use-app-version';
import { useBackupDate } from '../hooks/use-backup-date';

/** Props of {@link SettingsScreen}. */
export interface SettingsScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onOpenBackup: () => void;
  readonly onOpenLicenses: () => void;
}

/**
 * Pantalla de la pestaña Ajustes (F9): un índice sin datos propios. Una tarjeta con "Recordatorios"
 * y "Respaldo y planillas" (cada una con el resumen de su estado), la nota de privacidad y
 * "Acerca de" con la versión y las licencias de terceros. Nunca muestra una carga: mientras un
 * resumen no está, la fila se ve sin subtítulo y se puede tocar igual.
 */
export function SettingsScreen({
  onOpenNotifications,
  onOpenBackup,
  onOpenLicenses,
}: SettingsScreenProps) {
  const remindersSubtitle = reminderSummaryText(useReminderSummary());
  const backupSubtitle = backupSummaryText(useBackupDate());
  const version = versionText(useAppVersion());
  const { reminders, backup, privacy, about } = SETTINGS_TEXTS;
  return (
    <Screen>
      <ScreenHeader title={SETTINGS_TEXTS.title} />
      <ScrollView contentContainerClassName="gap-6 px-4 pt-4 pb-8">
        <Card>
          <ListRow
            title={reminders.title}
            subtitle={remindersSubtitle ?? undefined}
            accessibilityHint={reminders.hint}
            onPress={onOpenNotifications}
            trailing={<Icon icon={CaretRightIcon} color="muted" />}
          />
          <ListSeparator />
          <ListRow
            title={backup.title}
            subtitle={backupSubtitle}
            accessibilityHint={backup.hint}
            onPress={onOpenBackup}
            trailing={<Icon icon={CaretRightIcon} color="muted" />}
          />
        </Card>
        <SettingsSection heading={privacy.heading}>
          <PrivacyNote />
        </SettingsSection>
        <SettingsSection heading={about.heading}>
          <Card>
            <ListRow title={about.name} subtitle={version ?? undefined} />
            <ListSeparator />
            <ListRow
              title={about.licensesTitle}
              subtitle={about.licensesSubtitle}
              accessibilityHint={about.licensesHint}
              onPress={onOpenLicenses}
              trailing={<Icon icon={CaretRightIcon} color="muted" />}
            />
          </Card>
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}

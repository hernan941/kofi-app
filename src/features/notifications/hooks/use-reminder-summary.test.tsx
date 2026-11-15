import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { reminderSummaryText } from '../components/notification-texts';
import type { NotificationPreferences } from '../domain/preferences';
import { useReminderSummary } from './use-reminder-summary';
import { useSaveNotificationPreferences } from './use-save-notification-preferences';

const ALL_OFF: NotificationPreferences = {
  weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 },
  monthly: { enabled: false },
};

function SummaryProbe() {
  const summary = useReminderSummary();
  return <Text>{`resumen: ${reminderSummaryText(summary) ?? 'cargando'}`}</Text>;
}

function SaveProbe({ onReady }: { readonly onReady: (save: () => Promise<unknown>) => void }) {
  const save = useSaveNotificationPreferences();
  onReady(() => save.mutateAsync(ALL_OFF));
  return null;
}

describe('useReminderSummary', () => {
  it('starts loading and then describes the stored preferences and permission', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('granted');
    await renderWithProviders(<SummaryProbe />, { dependencies });

    expect(screen.getByText('resumen: cargando')).toBeOnTheScreen();
    expect(
      await screen.findByText('resumen: Domingos a las 20:00 y resumen del mes'),
    ).toBeOnTheScreen();
  });

  it('follows the permission of the phone', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('denied');
    await renderWithProviders(<SummaryProbe />, { dependencies });

    expect(
      await screen.findByText('resumen: Los avisos están apagados en tu teléfono'),
    ).toBeOnTheScreen();
  });

  it('updates after the preferences are saved', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('granted');
    let save: () => Promise<unknown> = () => Promise.resolve();
    await renderWithProviders(
      <>
        <SummaryProbe />
        <SaveProbe
          onReady={(next) => {
            save = next;
          }}
        />
      </>,
      { dependencies },
    );
    await screen.findByText('resumen: Domingos a las 20:00 y resumen del mes');

    await act(async () => {
      await save();
    });

    await waitFor(() => {
      expect(screen.getByText('resumen: Apagados')).toBeOnTheScreen();
    });
  });

  it('stays loading and logs the problem when the permission cannot be read', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.failNext('permission');
    await renderWithProviders(<SummaryProbe />, { dependencies });

    await waitFor(() => {
      expect(dependencies.logger.entriesAt('error').map((entry) => entry.event)).toContain(
        'reminder_summary_failed',
      );
    });
    expect(screen.getByText('resumen: cargando')).toBeOnTheScreen();
  });
});

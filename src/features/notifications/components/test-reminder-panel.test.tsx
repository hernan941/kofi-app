import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { TestReminderPanel } from './test-reminder-panel';

const user = userEvent.setup();

describe('TestReminderPanel', () => {
  it('explains that it only exists in test builds', async () => {
    await renderWithProviders(<TestReminderPanel />);

    expect(screen.getByRole('header', { name: 'Pruebas de avisos' })).toBeOnTheScreen();
    expect(screen.getByText('Solo aparece en las versiones de prueba.')).toBeOnTheScreen();
  });

  it('schedules a notice in one minute and confirms it', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('granted');
    await renderWithProviders(<TestReminderPanel />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Aviso en 1 minuto' }));

    expect(
      (await screen.findAllByText('Aviso de prueba programado', { includeHiddenElements: true }))
        .length,
    ).toBeGreaterThan(0);
    expect(dependencies.notifications.scheduledNow()).toHaveLength(1);
  });

  it('schedules the state B sequence and confirms it', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('granted');
    await renderWithProviders(<TestReminderPanel />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Secuencia del estado B' }));

    expect(
      (
        await screen.findAllByText('Secuencia de prueba programada', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(dependencies.notifications.scheduledNow()).toHaveLength(3);
  });

  it('asks to activate the notices when there is no permission', async () => {
    const dependencies = createTestDependencies();
    await renderWithProviders(<TestReminderPanel />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Aviso en 1 minuto' }));

    expect(
      (
        await screen.findAllByText('Activa los avisos para probarlos.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(dependencies.notifications.scheduledNow()).toEqual([]);
  });
});

import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { epochMsSchema } from '@/shared/domain';

import { useBackupDate } from './use-backup-date';

function Probe() {
  const date = useBackupDate();
  return <Text>{date === null ? 'sin copia' : date.text}</Text>;
}

describe('useBackupDate', () => {
  it('is null when there is no safety backup', async () => {
    await renderWithProviders(<Probe />);

    expect(await screen.findByText('sin copia')).toBeOnTheScreen();
  });

  it('gives the date of the safety backup relative to the clock', async () => {
    const dependencies = createTestDependencies();
    dependencies.backupFiles.safety = {
      uri: 'file:///fake/doc/safety/a.zip',
      createdAt: epochMsSchema.parse(dependencies.clock.now()),
    };
    await renderWithProviders(<Probe />, { dependencies });

    expect(await screen.findByText(/^hoy, \d{1,2}:\d{2}$/)).toBeOnTheScreen();
  });

  it('is null and logs the problem when reading the copy fails', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.backupFiles, 'latestSafety').mockImplementation(() => {
      throw new Error('The folder cannot be read.');
    });
    await renderWithProviders(<Probe />, { dependencies });

    await waitFor(() => {
      expect(dependencies.logger.entriesAt('error').map((entry) => entry.event)).toContain(
        'settings_backup_summary_failed',
      );
    });
    expect(screen.getByText('sin copia')).toBeOnTheScreen();
  });
});

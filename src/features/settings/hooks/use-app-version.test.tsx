import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { useAppVersion } from './use-app-version';

function Probe() {
  return <Text>{useAppVersion()}</Text>;
}

describe('useAppVersion', () => {
  it('gives the version of the app from the dependencies', async () => {
    await renderWithProviders(<Probe />, {
      dependencies: createTestDependencies({ appVersion: '2.3.4' }),
    });

    expect(screen.getByText('2.3.4')).toBeOnTheScreen();
  });
});

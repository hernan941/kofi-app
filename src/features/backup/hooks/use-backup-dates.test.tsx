import { renderHook } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';

import { dependenciesWrapper } from '../testing/dependencies-wrapper';
import { useBackupDates } from './use-backup-dates';

describe('useBackupDates', () => {
  it('formats a date relative to the clock of the app', async () => {
    const dependencies = createTestDependencies();
    const { result } = await renderHook(() => useBackupDates(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    expect(result.current.formatDate(dependencies.clock.now())).toMatchObject({
      isRelative: true,
      text: expect.stringMatching(/^hoy, \d{1,2}:\d{2}$/) as unknown,
    });
  });
});

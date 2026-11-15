import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { epochMsSchema } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';

import { useStreak } from './use-streak';

const MINUTE_MS = 60_000;

function localInstant(year: number, month: number, day: number, hour: number, minute: number) {
  return epochMsSchema.parse(new Date(year, month - 1, day, hour, minute).getTime());
}

function StreakProbe() {
  const { data } = useStreak();
  return data === undefined ? (
    <Text>loading</Text>
  ) : (
    <Text>{`${String(data.weeks)}|${String(data.includesCurrentWeek)}`}</Text>
  );
}

describe('useStreak around the Sunday midnight', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts a Sunday sale in the current week at 23:59 and in the previous week at 00:00', async () => {
    const dependencies = createTestDependencies();
    dependencies.clock.set(localInstant(2026, 7, 5, 23, 59));
    const product = seedSellableProduct(dependencies, { name: 'Lámina', price: 1000 });
    seedSale(dependencies, { product, soldOn: '2026-07-05', n: 1 });
    await renderWithProviders(
      <>
        <DataChangesBridge
          dataChanges={dependencies.dataChanges}
          dependencies={QUERY_DEPENDENCIES}
        />
        <StreakProbe />
      </>,
      { dependencies },
    );
    await screen.findByText('1|true');

    await act(() => {
      advanceClockAndTimers(dependencies.clock, 2 * MINUTE_MS);
    });

    await waitFor(() => {
      expect(screen.getByText('1|false')).toBeOnTheScreen();
    });
  });

  it('keeps counting a marked week when the new week starts', async () => {
    const dependencies = createTestDependencies();
    dependencies.clock.set(localInstant(2026, 7, 5, 23, 59));
    seedNoSalesWeek(dependencies, '2026-06-29');
    await renderWithProviders(<StreakProbe />, { dependencies });
    await screen.findByText('1|true');

    await act(() => {
      advanceClockAndTimers(dependencies.clock, 2 * MINUTE_MS);
    });

    await waitFor(() => {
      expect(screen.getByText('1|false')).toBeOnTheScreen();
    });
  });
});

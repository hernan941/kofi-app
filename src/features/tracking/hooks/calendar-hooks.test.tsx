import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { epochMsSchema, localDateSchema, weekRangeOf, yearMonthSchema } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';

import { useCalendarMonth } from './use-calendar-month';
import { useDayDetail } from './use-day-detail';
import { useWeekNoSales } from './use-week-no-sales';

const month = (text: string) => yearMonthSchema.parse(text);
const day = (text: string) => localDateSchema.parse(text);

describe('useCalendarMonth', () => {
  function CalendarProbe({ target }: { readonly target: string }) {
    const { status, calendar } = useCalendarMonth(month(target));
    const days = calendar?.weeks.flatMap((week) => week.days) ?? [];
    const july1 = days.find((d) => d.date === '2026-07-01');
    return (
      <Text>{`${status}|${String(calendar?.weeks.length)}|${String(july1?.activity?.total)}|${String(july1?.isToday)}`}</Text>
    );
  }

  it('builds the month from the sales of the grid range', async () => {
    const dependencies = createTestDependencies();
    const product = seedSellableProduct(dependencies, { price: 5000 });
    seedSale(dependencies, { product, soldOn: '2026-07-01', n: 1 });

    await renderWithProviders(<CalendarProbe target="2026-07" />, { dependencies });

    expect(await screen.findByText('ready|5|5000|true')).toBeOnTheScreen();
  });

  it('reads the sales and the marks once per month, in parallel', async () => {
    const dependencies = createTestDependencies();
    const salesSpy = jest.spyOn(dependencies.sales, 'listBetween');
    const marksSpy = jest.spyOn(dependencies.noSalesWeeks, 'listBetween');

    await renderWithProviders(<CalendarProbe target="2026-07" />, { dependencies });
    await screen.findByText(/^ready/);

    expect(salesSpy).toHaveBeenCalledTimes(1);
    expect(salesSpy).toHaveBeenCalledWith('2026-06-29', '2026-08-02');
    expect(marksSpy).toHaveBeenCalledTimes(1);
  });

  it('does not read again when the day changes inside the month, but moves today', async () => {
    jest.useFakeTimers();
    try {
      const dependencies = createTestDependencies();
      dependencies.clock.set(epochMsSchema.parse(new Date(2026, 6, 1, 23, 59).getTime()));
      const salesSpy = jest.spyOn(dependencies.sales, 'listBetween');
      await renderWithProviders(<CalendarProbe target="2026-07" />, { dependencies });
      await screen.findByText(/^ready\|5\|undefined\|true/);

      await act(() => {
        advanceClockAndTimers(dependencies.clock, 2 * 60_000);
      });

      await waitFor(() => {
        expect(screen.getByText('ready|5|undefined|false')).toBeOnTheScreen();
      });
      expect(salesSpy).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports an error when a read fails', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.sales, 'listBetween').mockRejectedValue(new Error('boom'));
    jest.spyOn(dependencies.logger, 'error').mockImplementation(() => undefined);

    await renderWithProviders(<CalendarProbe target="2026-07" />, { dependencies });

    expect(await screen.findByText('error|undefined|undefined|undefined')).toBeOnTheScreen();
  });
});

describe('useDayDetail', () => {
  function DayProbe({ target }: { readonly target: string }) {
    const { status, detail, records } = useDayDetail(day(target));
    return (
      <Text>{`${status}|${String(detail?.total)}|${String(detail?.canRegister)}|${records
        .map((view) => view.items[0]?.productName)
        .join(',')}`}</Text>
    );
  }

  it('totals the day and names the products with their current name', async () => {
    const dependencies = createTestDependencies();
    const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 4000 });
    seedSale(dependencies, { product, soldOn: '2026-06-30', n: 1, quantity: 2 });
    seedSale(dependencies, { product, soldOn: '2026-06-29', n: 2 });

    await renderWithProviders(<DayProbe target="2026-06-30" />, { dependencies });

    expect(await screen.findByText('ready|8000|true|Lámina Colibrí')).toBeOnTheScreen();
  });

  it('does not need ES2023 array methods, which Hermes does not provide', async () => {
    const dependencies = createTestDependencies();
    const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 4000 });
    seedSale(dependencies, { product, soldOn: '2026-06-30', n: 1 });
    const original = Array.prototype.toSorted;
    Reflect.deleteProperty(Array.prototype, 'toSorted');

    try {
      await renderWithProviders(<DayProbe target="2026-06-30" />, { dependencies });

      expect(await screen.findByText('ready|4000|true|Lámina Colibrí')).toBeOnTheScreen();
    } finally {
      Reflect.defineProperty(Array.prototype, 'toSorted', {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it('does not allow registering in a future day', async () => {
    await renderWithProviders(<DayProbe target="2026-07-02" />);

    expect(await screen.findByText('ready|0|false|')).toBeOnTheScreen();
  });
});

describe('useWeekNoSales', () => {
  const current = weekRangeOf(day('2026-07-01'));

  function WeekProbe({ week }: { readonly week: typeof current }) {
    const { status, mark, unmark } = useWeekNoSales(week);
    return (
      <>
        <Text>{String(status)}</Text>
        <Text
          onPress={() => {
            void mark();
          }}
        >
          mark
        </Text>
        <Text
          onPress={() => {
            void unmark();
          }}
        >
          unmark
        </Text>
      </>
    );
  }

  it('is markable with nothing', async () => {
    await renderWithProviders(<WeekProbe week={current} />);

    expect(await screen.findByText('markable')).toBeOnTheScreen();
  });

  it('is has_sales with a sale in the week', async () => {
    const dependencies = createTestDependencies();
    seedSale(dependencies, { product: seedSellableProduct(dependencies), soldOn: '2026-07-01' });

    await renderWithProviders(<WeekProbe week={current} />, { dependencies });

    expect(await screen.findByText('has_sales')).toBeOnTheScreen();
  });

  it('is marked with a mark in the week', async () => {
    const dependencies = createTestDependencies();
    seedNoSalesWeek(dependencies, '2026-06-29');

    await renderWithProviders(<WeekProbe week={current} />, { dependencies });

    expect(await screen.findByText('marked')).toBeOnTheScreen();
  });

  it('is not_allowed two weeks back', async () => {
    await renderWithProviders(<WeekProbe week={weekRangeOf(day('2026-06-17'))} />);

    expect(await screen.findByText('not_allowed')).toBeOnTheScreen();
  });

  it('marks and unmarks and the status follows without invalidating by hand', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<WeekProbe week={current} />, { observeDataChanges: true });
    await screen.findByText('markable');

    await user.press(screen.getByText('mark'));
    expect(await screen.findByText('marked')).toBeOnTheScreen();

    await user.press(screen.getByText('unmark'));
    expect(await screen.findByText('markable')).toBeOnTheScreen();
  });
});

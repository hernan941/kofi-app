import { act, screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { epochMsSchema } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';
import { clearPerfMarks, readPerfMarks } from '@/shared/lib/perf-marks';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import type * as dayLabel from '../components/day-label';
import { CalendarScreen } from './calendar-screen';

const mockRenderedDays: string[] = [];

jest.mock('../components/day-label', () => {
  const actual: typeof dayLabel = jest.requireActual('../components/day-label');
  return {
    ...actual,
    dayAccessibilityLabel: (...args: Parameters<typeof actual.dayAccessibilityLabel>) => {
      mockRenderedDays.push(args[0].date);
      return actual.dayAccessibilityLabel(...args);
    },
  };
});

const user = userEvent.setup();

function showCalendar(dependencies = createTestDependencies(), onOpenDay: jest.Mock = jest.fn()) {
  return renderWithProviders(<CalendarScreen onOpenDay={onOpenDay} />, {
    dependencies,
    observeDataChanges: true,
  });
}

function withSale() {
  const dependencies = createTestDependencies();
  const product = seedSellableProduct(dependencies, { price: 15000 });
  seedSale(dependencies, { product, soldOn: '2026-07-01', n: 1, quantity: 3 });
  seedSale(dependencies, { product, soldOn: '2026-06-10', n: 2 });
  return dependencies;
}

describe('CalendarScreen', () => {
  beforeEach(() => {
    mockRenderedDays.length = 0;
  });

  it('draws the whole grid inside the screen scroll, without virtualized lists', async () => {
    await showCalendar(withSale());
    await screen.findByText('Vendiste en julio', { includeHiddenElements: true });

    const scrollViews = screen.container.queryAll((node) => node.type === 'RCTScrollView');

    expect(scrollViews).toHaveLength(1);
  });

  it('redraws only the day cell that changed when the data is invalidated', async () => {
    const dependencies = createTestDependencies();
    await showCalendar(dependencies);
    await screen.findByText('Vendiste en julio', { includeHiddenElements: true });
    mockRenderedDays.length = 0;

    await act(() => {
      seedSale(dependencies, {
        product: seedSellableProduct(dependencies),
        soldOn: '2026-07-01',
      });
      dependencies.dataChanges.emit(new Set(['sale_records', 'sale_items']));
    });
    await screen.findByRole('button', { name: /^Hoy, 1 de julio, .* 1 venta$/ });

    expect(mockRenderedDays).toEqual(['2026-07-01']);
  });

  it('shows the title, the month, the total and the days with their label', async () => {
    await showCalendar(withSale());

    expect(screen.getByRole('header', { name: 'Calendario' })).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
    expect(
      await screen.findByText('Vendiste en julio', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Vendiste en julio: 45.000 pesos')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Hoy, 1 de julio, 45.000 pesos, 1 venta' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Un punto es poco y tres puntos es tu mejor día del mes.'),
    ).toBeOnTheScreen();
  });

  it('opens the detail of a day and does not offer a future day', async () => {
    const onOpenDay = jest.fn();
    await showCalendar(withSale(), onOpenDay);

    await user.press(await screen.findByRole('button', { name: '2 de julio, no disponible' }));
    expect(onOpenDay).not.toHaveBeenCalled();

    await user.press(
      await screen.findByRole('button', { name: 'Hoy, 1 de julio, 45.000 pesos, 1 venta' }),
    );
    expect(onOpenDay).toHaveBeenCalledWith('2026-07-01');
  });

  it('changes month, stays there and does not go past the current one', async () => {
    await showCalendar(withSale());
    expect(await screen.findByRole('button', { name: 'Mes siguiente' })).toBeDisabled();

    await user.press(await screen.findByRole('button', { name: 'Mes anterior, junio' }));

    expect(await screen.findByRole('header', { name: 'Junio' })).toBeOnTheScreen();
    expect(
      await screen.findByText('Vendiste en junio', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '10 de junio, 15.000 pesos, 1 venta' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes siguiente, julio' })).toBeEnabled();
  });

  it('offers "no vendí" only in the current month', async () => {
    await showCalendar(withSale());
    expect(await screen.findByText('¿Una semana sin ventas?')).toBeOnTheScreen();

    await user.press(await screen.findByRole('button', { name: 'Mes anterior, junio' }));
    await screen.findByText('Vendiste en junio', { includeHiddenElements: true });

    expect(screen.queryByText('¿Una semana sin ventas?')).not.toBeOnTheScreen();
  });

  it('shows the first use: gentle streak, $0, a hint and both weeks markable', async () => {
    await showCalendar();

    expect(
      await screen.findByText('Tu racha empieza cuando registras una semana'),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText('Los días en que registres ventas se marcan aquí con puntos.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('$0', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Marcar que no vendí esta semana' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Marcar que no vendí la semana pasada' }),
    ).toBeOnTheScreen();
    expect(findGuiltPattern('Tu racha empieza cuando registras una semana')).toBeNull();
  });

  it('shows a marked week with its text and updates the streak when marking', async () => {
    await showCalendar();
    await user.press(
      await screen.findByRole('button', { name: 'Marcar que no vendí esta semana' }),
    );

    expect(await screen.findByText('Semana marcada como "no vendí"')).toBeOnTheScreen();
    expect(await screen.findByText('1 semana')).toBeOnTheScreen();
  });

  it('shows a week marked before with its text', async () => {
    const dependencies = createTestDependencies();
    seedNoSalesWeek(dependencies, '2026-06-29');
    await showCalendar(dependencies);

    expect(await screen.findByText('Semana marcada como "no vendí"')).toBeOnTheScreen();
  });

  it('updates the streak when a sale is saved', async () => {
    const dependencies = createTestDependencies();
    await showCalendar(dependencies);
    await screen.findByText('Tu racha empieza cuando registras una semana');

    await act(() => {
      seedSale(dependencies, {
        product: seedSellableProduct(dependencies),
        soldOn: '2026-07-01',
      });
      dependencies.dataChanges.emit(new Set(['sale_records', 'sale_items']));
    });

    expect(await screen.findByText('1 semana')).toBeOnTheScreen();
  });

  it('keeps the month on screen and moves today when the week changes', async () => {
    jest.useFakeTimers();
    try {
      const dependencies = createTestDependencies();
      dependencies.clock.set(epochMsSchema.parse(new Date(2026, 6, 5, 23, 59).getTime()));
      seedSale(dependencies, { product: seedSellableProduct(dependencies), soldOn: '2026-07-05' });
      await showCalendar(dependencies);
      await screen.findByText('1 semana');
      expect(
        screen.getByText('Semanas registrando, con ventas o con "no vendí".'),
      ).toBeOnTheScreen();

      await act(() => {
        advanceClockAndTimers(dependencies.clock, 2 * 60_000);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Esta semana suma cuando registres una venta o marques "no vendí".'),
        ).toBeOnTheScreen();
      });
      expect(screen.getByRole('header', { name: 'Julio' })).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows an error with a retry when the month cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.sales, 'listBetween').mockRejectedValue(new Error('boom'));
    jest.spyOn(dependencies.logger, 'error').mockImplementation(() => undefined);
    await showCalendar(dependencies);

    expect(
      await screen.findByText('No se pudo cargar el calendario. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
  });
});

describe('CalendarScreen performance marks (P3)', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
    clearPerfMarks();
  });

  it('marks calendar:ready once, then press and ready of each month change with the month', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    await showCalendar(withSale());
    await screen.findByText('Vendiste en julio', { includeHiddenElements: true });

    await user.press(await screen.findByRole('button', { name: 'Mes anterior, junio' }));
    await screen.findByText('Vendiste en junio', { includeHiddenElements: true });

    expect(readPerfMarks().map(({ name, detail }) => [name, detail])).toEqual([
      ['calendar:ready', '2026-07'],
      ['calendar:month:ready', '2026-07'],
      ['calendar:month:press', '2026-06'],
      ['calendar:month:ready', '2026-06'],
    ]);
  });
});

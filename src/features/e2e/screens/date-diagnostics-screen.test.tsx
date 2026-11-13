import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import { localDateSchema } from '@/shared/domain/calendar/local-date';

import { SANTIAGO_DIAGNOSTIC_CASES } from '../domain/santiago-diagnostic-cases';
import { DateDiagnosticsScreen } from './date-diagnostics-screen';

describe('DateDiagnosticsScreen', () => {
  it('says that every case matches on a device in the expected zone', async () => {
    await renderWithProviders(<DateDiagnosticsScreen />);

    expect(screen.getByRole('header', { name: 'Diagnóstico de fechas' })).toBeOnTheScreen();
    expect(screen.getByText('Todos los casos coinciden')).toBeOnTheScreen();
    expect(screen.getByText('America/Santiago')).toBeOnTheScreen();
  });

  it('uses the calendar of the injected dependencies and counts the failures', async () => {
    const calendar = {
      ...deviceLocalCalendar,
      localDateOf: () => localDateSchema.parse('1999-01-01'),
    };

    await renderWithProviders(<DateDiagnosticsScreen />, {
      dependencies: createTestDependencies({ calendar }),
    });

    expect(screen.getByText(/casos no coinciden/)).toBeOnTheScreen();
    expect(screen.queryByText('Todos los casos coinciden')).not.toBeOnTheScreen();
  });

  it('uses the singular when exactly one case differs', async () => {
    const [first] = SANTIAGO_DIAGNOSTIC_CASES.localDates;
    const calendar = {
      ...deviceLocalCalendar,
      localDateOf: (...args: Parameters<typeof deviceLocalCalendar.localDateOf>) =>
        args[0] === first?.instant
          ? localDateSchema.parse('1999-01-01')
          : deviceLocalCalendar.localDateOf(...args),
    };

    await renderWithProviders(<DateDiagnosticsScreen />, {
      dependencies: createTestDependencies({ calendar }),
    });

    expect(screen.getByText('1 caso no coincide')).toBeOnTheScreen();
  });
});

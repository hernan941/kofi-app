import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';
import { signedClpSchema } from '@/shared/domain';

import { compareTotals, type HomeSummary, type PeriodSummary } from '../domain';
import { clp } from '../domain/testing/tracking-fixtures';
import { HomeSummaryCard } from './home-summary-card';

const user = userEvent.setup();

function period(total: number, previousTotal: number): PeriodSummary {
  return {
    total: clp(total),
    previousTotal: clp(previousTotal),
    comparison: compareTotals(clp(total), clp(previousTotal)),
  };
}

function summaryOf(week: PeriodSummary, month: PeriodSummary): HomeSummary {
  return { week, month, monthRecords: [] };
}

const BASE_PROPS = {
  monthName: 'noviembre',
  previousMonthName: 'octubre',
  onOpenMonthlySummary: jest.fn(),
};

describe('HomeSummaryCard', () => {
  it('shows the week as the main amount and the month as a list amount', async () => {
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        summary={summaryOf(period(45000, 40000), period(120000, 100000))}
        profit={null}
      />,
    );

    expect(screen.getByText('Esta semana')).toBeOnTheScreen();
    expect(screen.getByText('En noviembre')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('45.000 pesos')[0]).toHaveProp(
      'className',
      expect.stringContaining('text-display'),
    );
    expect(screen.getAllByLabelText('120.000 pesos')[0]).toHaveProp(
      'className',
      expect.stringContaining('text-lg'),
    );
  });

  it('reads the week block as a single element with its comparison', async () => {
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        summary={summaryOf(period(45000, 40000), period(120000, 100000))}
        profit={null}
      />,
    );

    expect(
      screen.getByLabelText(
        'Esta semana vendiste 45.000 pesos. 5.000 pesos más que a esta altura de la semana pasada.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'En noviembre vendiste 120.000 pesos. 20.000 pesos más que a esta altura de octubre.',
      ),
    ).toBeOnTheScreen();
  });

  it('words a drop without blame', async () => {
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        summary={summaryOf(period(15000, 20000), period(120000, 100000))}
        profit={null}
      />,
    );

    expect(
      screen.getByText(
        '$5.000 menos que a esta altura de la semana pasada. Cada semana tiene su ritmo.',
      ),
    ).toBeOnTheScreen();
  });

  it('does not show the profit without costs', async () => {
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        summary={summaryOf(period(45000, 40000), period(120000, 100000))}
        profit={null}
      />,
    );

    expect(screen.queryByText(/te quedaron aprox\./)).not.toBeOnTheScreen();
  });

  it('shows the profit of the month when there are costs', async () => {
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        summary={summaryOf(period(45000, 40000), period(120000, 100000))}
        profit={{
          profit: signedClpSchema.parse(9000),
          revenueWithCost: clp(1),
          revenueTotal: clp(1),
        }}
      />,
    );

    expect(screen.getByText('Este mes te quedaron aprox. $9.000.')).toBeOnTheScreen();
  });

  it('opens the monthly summary', async () => {
    const onOpenMonthlySummary = jest.fn();
    await renderUi(
      <HomeSummaryCard
        {...BASE_PROPS}
        onOpenMonthlySummary={onOpenMonthlySummary}
        summary={summaryOf(period(0, 0), period(0, 0))}
        profit={null}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Ver resumen de noviembre' }));

    expect(onOpenMonthlySummary).toHaveBeenCalledTimes(1);
  });
});

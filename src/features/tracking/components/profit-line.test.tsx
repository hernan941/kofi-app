import { screen } from '@testing-library/react-native';

import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { renderUi } from '@/shared/ui/testing/render-ui';
import { signedClpSchema } from '@/shared/domain';

import type { ProfitSummary } from '../domain';
import { clp } from '../domain/testing/tracking-fixtures';
import { ProfitLine } from './profit-line';

function profitOf(profit: number, withCost: number, total: number): ProfitSummary {
  return {
    profit: signedClpSchema.parse(profit),
    revenueWithCost: clp(withCost),
    revenueTotal: clp(total),
  };
}

describe('ProfitLine', () => {
  it('draws nothing without costs', async () => {
    await renderUi(<ProfitLine profit={null} periodLabel="Este mes" />);

    expect(screen.queryByText(/./)).not.toBeOnTheScreen();
  });

  it('says what was left when every sale has a cost', async () => {
    await renderUi(<ProfitLine profit={profitOf(9000, 20000, 20000)} periodLabel="Este mes" />);

    expect(screen.getByLabelText('Este mes te quedaron aprox. 9.000 pesos.')).toHaveTextContent(
      'Este mes te quedaron aprox. $9.000.',
    );
  });

  it('says it only counts what has a cost when the coverage is partial (D-15)', async () => {
    await renderUi(<ProfitLine profit={profitOf(9000, 10000, 20000)} periodLabel="En octubre" />);

    expect(
      screen.getByText('En octubre, de lo que tiene costo cargado, te quedaron aprox. $9.000.'),
    ).toBeOnTheScreen();
  });

  it('shows a negative profit with a calm explanation and no blame', async () => {
    await renderUi(<ProfitLine profit={profitOf(-5000, 20000, 20000)} periodLabel="Este mes" />);

    expect(screen.getByText('Este mes te quedaron aprox. -$5.000.')).toBeOnTheScreen();
    const help = screen.getByText('A veces pasa, por ejemplo con descuentos o precios especiales.');
    expect(help).toBeOnTheScreen();
    expect(findGuiltPattern(String(help.props.children))).toBeNull();
  });
});

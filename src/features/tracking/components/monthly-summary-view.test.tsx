import { screen } from '@testing-library/react-native';

import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import {
  localDateSchema,
  productIdSchema,
  signedClpSchema,
  yearMonthSchema,
} from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { MonthlySummary } from '../domain';
import type { ProductNameView } from '../hooks/use-monthly-summary';
import { clp } from '../domain/testing/tracking-fixtures';
import { MonthlySummaryView } from './monthly-summary-view';

const today = localDateSchema.parse('2026-11-13');
const month = (text: string) => yearMonthSchema.parse(text);

function summaryOf(overrides: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    month: month('2026-11'),
    total: clp(45000),
    recordCount: 3,
    topProducts: [],
    topChannels: [],
    ...overrides,
  };
}

function top(name: string | null, revenue: number, isArchived = false): ProductNameView {
  return {
    productId: productIdSchema.parse('11111111-1111-7111-8111-000000000001'),
    name,
    isArchived,
    revenue: clp(revenue),
  };
}

describe('MonthlySummaryView', () => {
  it('shows the total as the main amount and counts the records', async () => {
    await renderUi(
      <MonthlySummaryView summary={summaryOf()} topProducts={[]} profit={null} today={today} />,
    );

    expect(screen.getByText('Vendiste', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Vendiste: 45.000 pesos, 3 ventas registradas')).toBeOnTheScreen();
    expect(screen.getByText('$45.000', { includeHiddenElements: true })).toHaveProp(
      'className',
      expect.stringContaining('text-display'),
    );
    expect(
      screen.getByText('3 ventas registradas', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('uses the singular for one record', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ recordCount: 1 })}
        topProducts={[]}
        profit={null}
        today={today}
      />,
    );

    expect(
      screen.getByText('1 venta registrada', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('invites to register when the current month has no sales', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ total: clp(0), recordCount: 0 })}
        topProducts={[]}
        profit={null}
        today={today}
      />,
    );

    const title = screen.getByText('Noviembre no tiene ventas anotadas');
    expect(title).toBeOnTheScreen();
    expect(
      screen.getByText('Las ventas que registres este mes van a aparecer aquí.'),
    ).toBeOnTheScreen();
    expect(findGuiltPattern(String(title.props.children))).toBeNull();
  });

  it('explains how to add a past month without sales', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ month: month('2026-10'), total: clp(0), recordCount: 0 })}
        topProducts={[]}
        profit={null}
        today={today}
      />,
    );

    expect(screen.getByText('Octubre no tiene ventas anotadas')).toBeOnTheScreen();
    expect(
      screen.getByText('Si vendiste algo en octubre, puedes registrarlo eligiendo esa fecha.'),
    ).toBeOnTheScreen();
  });

  it('shows the top products by amount, with a note when they tie', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({
          topProducts: [{ productId: top('A', 1).productId, revenue: clp(30000) }],
        })}
        topProducts={[top('Lámina', 30000), top('Taza', 30000, true)]}
        profit={null}
        today={today}
      />,
    );

    expect(screen.getByRole('header', { name: 'Lo que más vendiste' })).toBeOnTheScreen();
    expect(screen.getByText('Según el monto vendido.')).toBeOnTheScreen();
    expect(screen.getByText('Empataron con el mismo monto.')).toBeOnTheScreen();
    expect(screen.getByText('Lámina', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Taza', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Archivado', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('omits the tie note with a single top product and the card without any', async () => {
    const { rerender } = await renderUi(
      <MonthlySummaryView
        summary={summaryOf()}
        topProducts={[top('Lámina', 30000)]}
        profit={null}
        today={today}
      />,
    );

    expect(screen.queryByText('Empataron con el mismo monto.')).not.toBeOnTheScreen();

    await rerender(
      <MonthlySummaryView summary={summaryOf()} topProducts={[]} profit={null} today={today} />,
    );

    expect(screen.queryByText('Lo que más vendiste')).not.toBeOnTheScreen();
  });

  it('shows the top channels with their labels and hides the card without channels', async () => {
    const { rerender } = await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ topChannels: [{ channel: 'fair', revenue: clp(30000) }] })}
        topProducts={[]}
        profit={null}
        today={today}
      />,
    );

    expect(screen.getByRole('header', { name: 'Dónde vendiste más' })).toBeOnTheScreen();
    expect(screen.getByText('Feria', { includeHiddenElements: true })).toBeOnTheScreen();

    await rerender(
      <MonthlySummaryView summary={summaryOf()} topProducts={[]} profit={null} today={today} />,
    );

    expect(screen.queryByText('Dónde vendiste más')).not.toBeOnTheScreen();
  });

  it('shows the profit of a past month with its name', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ month: month('2026-10') })}
        topProducts={[]}
        profit={{
          profit: signedClpSchema.parse(9000),
          revenueWithCost: clp(1),
          revenueTotal: clp(1),
        }}
        today={today}
      />,
    );

    expect(screen.getByText('En octubre te quedaron aprox. $9.000.')).toBeOnTheScreen();
  });

  it('says "Este mes" for the current month', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf()}
        topProducts={[]}
        profit={{
          profit: signedClpSchema.parse(9000),
          revenueWithCost: clp(1),
          revenueTotal: clp(1),
        }}
        today={today}
      />,
    );

    expect(screen.getByText('Este mes te quedaron aprox. $9.000.')).toBeOnTheScreen();
  });

  it('shows a month with sales of $0 only, without top products', async () => {
    await renderUi(
      <MonthlySummaryView
        summary={summaryOf({ total: clp(0), recordCount: 2 })}
        topProducts={[]}
        profit={null}
        today={today}
      />,
    );

    expect(screen.getByText('$0', { includeHiddenElements: true })).toHaveTextContent('$0');
    expect(screen.queryByText('Lo que más vendiste')).not.toBeOnTheScreen();
  });
});

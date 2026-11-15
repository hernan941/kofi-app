import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import type { SaleRecordId } from '@/shared/domain';
import { seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { makeTip } from '../domain/testing/tip-fixtures';
import { createFixtureTipCatalog } from '../testing/fixture-tip-catalog';
import { AfterSaleTip } from './after-sale-tip';

const user = userEvent.setup();
const TIP = makeTip('costos-uno', {
  category: 'costs',
  title: 'Cuenta tu tiempo',
  body: 'Suma tu tiempo al costo.',
  trigger: 'no_costs',
});

function setup(): { dependencies: TestDependencies; recordId: SaleRecordId } {
  const dependencies = createTestDependencies({ tipCatalog: createFixtureTipCatalog([TIP]) });
  const record = seedSale(dependencies, { product: seedSellableProduct(dependencies) });
  return { dependencies, recordId: record.id };
}

describe('AfterSaleTip', () => {
  it('shows the chosen tip and marks it seen once', async () => {
    const { dependencies, recordId } = setup();
    const markSeen = jest.spyOn(dependencies.tipViews, 'markSeen');

    await renderWithProviders(<AfterSaleTip recordId={recordId} isFirstSale />, { dependencies });

    expect(await screen.findByText('Consejo · Costos')).toBeOnTheScreen();
    expect(screen.getByText('Suma tu tiempo al costo.')).toBeOnTheScreen();
    await waitFor(() => {
      expect(markSeen).toHaveBeenCalledTimes(1);
    });
    expect(markSeen).toHaveBeenCalledWith(TIP.id, dependencies.clock.now());
  });

  it('closes, announces it, moves the focus to Listo and does not come back', async () => {
    const { dependencies, recordId } = setup();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onClosed = jest.fn();
    const view = await renderWithProviders(
      <AfterSaleTip recordId={recordId} isFirstSale onClosed={onClosed} />,
      { dependencies, observeDataChanges: true },
    );
    await screen.findByText('Consejo · Costos');

    await user.press(screen.getByRole('button', { name: 'Cerrar consejo' }));

    expect(screen.queryByText('Consejo · Costos')).not.toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Consejo cerrado');
    expect(onClosed).toHaveBeenCalledTimes(1);
    await view.rerender(<AfterSaleTip recordId={recordId} isFirstSale onClosed={onClosed} />);
    expect(screen.queryByText('Consejo · Costos')).not.toBeOnTheScreen();
  });

  it('draws nothing when the sale is not found', async () => {
    const { recordId } = setup();
    const dependencies = createTestDependencies({ tipCatalog: createFixtureTipCatalog([TIP]) });
    const markSeen = jest.spyOn(dependencies.tipViews, 'markSeen');
    const findById = jest.spyOn(dependencies.sales, 'findById');

    await renderWithProviders(<AfterSaleTip recordId={recordId} isFirstSale />, { dependencies });

    await waitFor(() => {
      expect(findById).toHaveBeenCalledTimes(1);
    });
    await findById.mock.results[0]?.value;
    expect(screen.queryByText(/Consejo/)).not.toBeOnTheScreen();
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('draws nothing and logs a warning when the choice fails', async () => {
    const { dependencies, recordId } = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));

    await renderWithProviders(<AfterSaleTip recordId={recordId} isFirstSale />, { dependencies });

    await waitFor(() => {
      expect(
        dependencies.logger.entries.some((entry) => entry.event === 'after_sale_tip_failed'),
      ).toBe(true);
    });
    expect(screen.queryByText(/Consejo/)).not.toBeOnTheScreen();
  });

  it('has no guilt in the text it draws', async () => {
    const { dependencies, recordId } = setup();

    await renderWithProviders(<AfterSaleTip recordId={recordId} isFirstSale />, { dependencies });
    await screen.findByText('Consejo · Costos');

    const texts = screen
      .getAllByText(/.+/)
      .flatMap((node) => [node.props.children as unknown].flat())
      .filter((child): child is string => typeof child === 'string');
    expect(texts).toContain('Consejo · Costos');
    for (const text of [...texts, 'Cerrar consejo', 'Consejo cerrado']) {
      expect(findGuiltPattern(text)).toBeNull();
    }
  });
});

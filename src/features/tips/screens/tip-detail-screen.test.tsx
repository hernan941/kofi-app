import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { makeTip, tipId } from '../domain/testing/tip-fixtures';
import { createFixtureTipCatalog } from '../testing/fixture-tip-catalog';
import { TipDetailScreen } from './tip-detail-screen';

const user = userEvent.setup();
const TIP = makeTip('costos-uno', {
  category: 'costs',
  title: 'Cuenta tu tiempo',
  body: 'Suma tu tiempo al costo.',
});

function setup() {
  return createTestDependencies({ tipCatalog: createFixtureTipCatalog([TIP]) });
}

describe('TipDetailScreen', () => {
  it('shows the category in the header, the title and the body', async () => {
    await renderWithProviders(
      <TipDetailScreen tipId={TIP.id} onBack={jest.fn()} onUnknownTip={jest.fn()} />,
      { dependencies: setup() },
    );

    expect(screen.getByRole('header', { name: 'Costos' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Cuenta tu tiempo' })).toBeOnTheScreen();
    expect(screen.getByText('Suma tu tiempo al costo.')).toBeOnTheScreen();
  });

  it('marks the tip as seen once when it opens', async () => {
    const dependencies = setup();
    const markSeen = jest.spyOn(dependencies.tipViews, 'markSeen');

    await renderWithProviders(
      <TipDetailScreen tipId={TIP.id} onBack={jest.fn()} onUnknownTip={jest.fn()} />,
      { dependencies },
    );

    await waitFor(() => {
      expect(markSeen).toHaveBeenCalledTimes(1);
    });
    expect(markSeen).toHaveBeenCalledWith(TIP.id, dependencies.clock.now());
  });

  it('goes back with the header button', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <TipDetailScreen tipId={TIP.id} onBack={onBack} onUnknownTip={jest.fn()} />,
      { dependencies: setup() },
    );

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('reports an id that is not in the catalog and marks nothing', async () => {
    const dependencies = setup();
    const markSeen = jest.spyOn(dependencies.tipViews, 'markSeen');
    const onUnknownTip = jest.fn();

    await renderWithProviders(
      <TipDetailScreen tipId={tipId('no-existe')} onBack={jest.fn()} onUnknownTip={onUnknownTip} />,
      { dependencies },
    );

    await waitFor(() => {
      expect(onUnknownTip).toHaveBeenCalledTimes(1);
    });
    expect(markSeen).not.toHaveBeenCalled();
  });
});

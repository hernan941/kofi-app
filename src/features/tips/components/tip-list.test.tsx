import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { tipSections } from '../domain';
import { makeTip, makeView, tipId, viewsOf } from '../domain/testing/tip-fixtures';
import { TipList } from './tip-list';

const user = userEvent.setup();

const TIPS = [
  makeTip('costos-uno', { category: 'costs', title: 'Pon costo a tu tiempo' }),
  makeTip('registro-uno', { category: 'recording', title: 'Anota cada venta' }),
  makeTip('registro-dos', { category: 'recording', title: 'Anota el canal' }),
];

function renderList(onOpenTip = jest.fn()) {
  const sections = tipSections(TIPS, viewsOf(makeView('registro-uno', 10)));
  return renderUi(<TipList sections={sections} onOpenTip={onOpenTip} />);
}

describe('TipList', () => {
  it('shows a header per category, in the order of the catalog', async () => {
    await renderList();

    expect(screen.getAllByRole('header').map((header) => header.props.children as string)).toEqual([
      'Registro',
      'Costos',
    ]);
  });

  it('announces a seen tip with text in its label and shows "Visto" with its icon', async () => {
    await renderList();

    expect(
      screen.getByRole('button', { name: 'Anota cada venta, Registro, visto' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Visto', { includeHiddenElements: true })).toHaveLength(1);
    expect(
      screen.getByTestId('phosphor-react-native-check-bold', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('leaves unseen tips without any mark', async () => {
    await renderList();

    expect(screen.getByRole('button', { name: 'Anota el canal, Registro' })).toBeOnTheScreen();
    expect(screen.queryByText('Nuevo')).not.toBeOnTheScreen();
  });

  it('opens a tip by its id', async () => {
    const onOpenTip = jest.fn();
    await renderList(onOpenTip);

    await user.press(screen.getByRole('button', { name: 'Pon costo a tu tiempo, Costos' }));

    expect(onOpenTip).toHaveBeenCalledWith(tipId('costos-uno'));
  });
});

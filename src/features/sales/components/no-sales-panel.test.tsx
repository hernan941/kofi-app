import { screen, userEvent } from '@testing-library/react-native';

import { weekRangeOf } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { NoSalesPrompt } from '../domain';
import { date } from '../domain/testing/sale-fixtures';
import { NoSalesPanel } from './no-sales-panel';

const user = userEvent.setup();

const current = weekRangeOf(date('2026-11-13'));
const previous = weekRangeOf(date('2026-11-06'));

function renderPanel(prompt: NoSalesPrompt) {
  const onMark = jest.fn();
  const onUnmark = jest.fn();
  const view = renderUi(<NoSalesPanel prompt={prompt} onMark={onMark} onUnmark={onUnmark} />);
  return { onMark, onUnmark, view };
}

describe('NoSalesPanel', () => {
  it('offers to mark the current week', async () => {
    const { onMark, view } = renderPanel({ kind: 'single', week: current, which: 'current' });
    await view;

    expect(
      screen.getByText('¿No vendiste nada esta semana? Anotarlo también cuenta.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Esta semana no vendí' }));

    expect(onMark).toHaveBeenCalledWith({ weekStart: current.start, which: 'current' });
  });

  it('offers to mark the previous week with its range', async () => {
    const { onMark, view } = renderPanel({ kind: 'single', week: previous, which: 'previous' });
    await view;

    expect(
      screen.getByText(
        '¿No vendiste nada la semana pasada (del 2 al 8 de noviembre)? Anotarlo también cuenta.',
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'La semana pasada no vendí' }));

    expect(onMark).toHaveBeenCalledWith({ weekStart: previous.start, which: 'previous' });
  });

  describe('when asking which week', () => {
    const choose: NoSalesPrompt = { kind: 'choose', previous, current, preselected: 'previous' };

    it('preselects the previous week and says so for the screen reader', async () => {
      const { view } = renderPanel(choose);
      await view;

      expect(screen.getByText('¿No vendiste nada? Elige la semana.')).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: 'La semana pasada' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Esta semana' })).not.toBeChecked();
      expect(screen.getByText('del 2 al 8 de noviembre')).toBeOnTheScreen();
    });

    it('marks the preselected week', async () => {
      const { onMark, view } = renderPanel(choose);
      await view;

      await user.press(screen.getByRole('button', { name: 'Marcar que no vendí' }));

      expect(onMark).toHaveBeenCalledWith({ weekStart: previous.start, which: 'previous' });
    });

    it('marks the current week when it is chosen', async () => {
      const { onMark, view } = renderPanel(choose);
      await view;

      await user.press(screen.getByRole('radio', { name: 'Esta semana' }));
      expect(screen.getByText('desde el lunes 9')).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Marcar que no vendí' }));

      expect(onMark).toHaveBeenCalledWith({ weekStart: current.start, which: 'current' });
    });
  });

  it('shows the marked week with a way to undo it', async () => {
    const { onUnmark, view } = renderPanel({ kind: 'marked', week: current });
    await view;

    expect(screen.getByText('Marcaste que esta semana no vendiste.')).toBeOnTheScreen();
    const undo = screen.getByRole('button', { name: 'Desmarcar' });
    expect(undo).toHaveProp('accessibilityHint', 'Quita la marca de esta semana');
    await user.press(undo);

    expect(onUnmark).toHaveBeenCalledWith({ weekStart: current.start });
  });

  it('explains kindly that a week with sales does not need the mark', async () => {
    const { view } = renderPanel({ kind: 'has_sales', week: current });
    await view;

    expect(
      screen.getByText('Esta semana ya tiene ventas, así que no hace falta marcar "no vendí".'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

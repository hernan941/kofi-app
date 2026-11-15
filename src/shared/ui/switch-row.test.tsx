import { screen, userEvent } from '@testing-library/react-native';

import { SwitchRow } from './switch-row';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('SwitchRow', () => {
  it('reads as one switch named by its title, with the description as hint', async () => {
    await renderUi(
      <SwitchRow
        title="Recordatorio semanal"
        description="Un aviso por semana."
        value
        onChange={jest.fn()}
      />,
    );

    const row = screen.getByRole('switch', { name: 'Recordatorio semanal' });
    expect(row).toBeChecked();
    expect(row.props.accessibilityHint).toBe('Un aviso por semana.');
    expect(screen.getByText('Un aviso por semana.')).toBeOnTheScreen();
  });

  it('shows the unchecked state', async () => {
    await renderUi(<SwitchRow title="Resumen" value={false} onChange={jest.fn()} />);

    expect(screen.getByRole('switch', { name: 'Resumen' })).not.toBeChecked();
  });

  it('asks for the opposite value when the row is pressed', async () => {
    const onChange = jest.fn();
    await renderUi(<SwitchRow title="Resumen" value={false} onChange={onChange} />);

    await user.press(screen.getByText('Resumen'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('asks for the opposite value when the switch itself is pressed', async () => {
    const onChange = jest.fn();
    await renderUi(<SwitchRow title="Resumen" value onChange={onChange} />);

    await user.press(screen.getByTestId('switch-row-control', { includeHiddenElements: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange when disabled', async () => {
    const onChange = jest.fn();
    await renderUi(<SwitchRow title="Resumen" value isDisabled onChange={onChange} />);

    await user.press(screen.getByText('Resumen'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Resumen' })).toBeDisabled();
  });
});

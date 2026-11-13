import { screen, userEvent } from '@testing-library/react-native';

import { Chip } from './chip';
import { ChipGroup } from './chip-group';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

const CHECK_ICON = 'phosphor-react-native-check-bold';

describe('Chip', () => {
  it('exposes the selected state and shows the check', async () => {
    await renderUi(<Chip label="Feria" isSelected onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Feria' })).toBeSelected();
    expect(screen.getByTestId(CHECK_ICON, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('has no check while not selected and reports presses', async () => {
    const onPress = jest.fn();
    await renderUi(<Chip label="Feria" isSelected={false} onPress={onPress} />);

    const chip = screen.getByRole('button', { name: 'Feria' });
    await user.press(chip);

    expect(chip).not.toBeSelected();
    expect(screen.queryByTestId(CHECK_ICON, { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ChipGroup', () => {
  const options = [
    { value: 'fair', label: 'Feria' },
    { value: 'online', label: 'Por internet' },
  ] as const;

  it('works as a group of options with one checked', async () => {
    const onChange = jest.fn();
    await renderUi(
      <ChipGroup label="Dónde vendiste" options={options} value="fair" onChange={onChange} />,
    );

    await user.press(screen.getByRole('radio', { name: 'Por internet' }));

    expect(screen.getByLabelText('Dónde vendiste')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByRole('radio', { name: 'Feria' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Por internet' })).not.toBeChecked();
    expect(onChange).toHaveBeenCalledWith('online');
  });

  it('does not deselect without allowDeselect: pressing the chosen option repeats it', async () => {
    const onChange = jest.fn();
    await renderUi(
      <ChipGroup label="Dónde vendiste" options={options} value="fair" onChange={onChange} />,
    );

    await user.press(screen.getByRole('radio', { name: 'Feria' }));

    expect(onChange).toHaveBeenCalledWith('fair');
  });

  describe('with allowDeselect', () => {
    it('deselects the chosen chip by pressing it again', async () => {
      const onChange = jest.fn();
      await renderUi(
        <ChipGroup
          label="Dónde vendiste"
          options={options}
          value="fair"
          allowDeselect
          onChange={onChange}
        />,
      );

      await user.press(screen.getByRole('button', { name: 'Feria' }));

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('chooses another chip with its value', async () => {
      const onChange = jest.fn();
      await renderUi(
        <ChipGroup
          label="Dónde vendiste"
          options={options}
          value="fair"
          allowDeselect
          onChange={onChange}
        />,
      );

      await user.press(screen.getByRole('button', { name: 'Por internet' }));

      expect(onChange).toHaveBeenCalledWith('online');
    });

    it('is a labelled group of toggle buttons with the selected state, not a radio group', async () => {
      await renderUi(
        <ChipGroup
          label="Dónde vendiste"
          options={options}
          value="fair"
          allowDeselect
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByLabelText('Dónde vendiste')).not.toHaveProp(
        'accessibilityRole',
        'radiogroup',
      );
      expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Feria' })).toBeSelected();
      expect(screen.getByRole('button', { name: 'Por internet' })).not.toBeSelected();
    });

    it('starts with nothing chosen', async () => {
      await renderUi(
        <ChipGroup
          label="Dónde vendiste"
          options={options}
          value={null}
          allowDeselect
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'Feria' })).not.toBeSelected();
      expect(screen.getByRole('button', { name: 'Por internet' })).not.toBeSelected();
    });
  });
});

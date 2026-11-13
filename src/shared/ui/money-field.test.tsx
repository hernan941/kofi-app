import { screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { MoneyField } from './money-field';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

function ControlledMoneyField() {
  const [value, setValue] = useState('');
  return <MoneyField label="Precio" value={value} onChangeText={setValue} />;
}

describe('MoneyField', () => {
  it('uses the number pad and a fixed "$" prefix', async () => {
    await renderUi(<ControlledMoneyField />);

    expect(screen.getByLabelText('Precio')).toHaveProp('keyboardType', 'number-pad');
    expect(screen.getByText('$', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('groups thousands while typing', async () => {
    await renderUi(<ControlledMoneyField />);

    await user.type(screen.getByLabelText('Precio'), '15000');

    expect(screen.getByLabelText('Precio')).toHaveDisplayValue('15.000');
  });
});

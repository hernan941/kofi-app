import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccessibleGroup } from './accessible-group';
import { renderUi } from './testing/render-ui';

describe('AccessibleGroup', () => {
  it('is a single stop with the label of the group', async () => {
    await renderUi(
      <AccessibleGroup label="Vendiste en noviembre: 45.000 pesos">
        <Text>Vendiste en noviembre</Text>
        <Text>$45.000</Text>
      </AccessibleGroup>,
    );

    expect(screen.getByLabelText('Vendiste en noviembre: 45.000 pesos')).toBeOnTheScreen();
  });

  it('hides its parts from the screen reader but keeps them on screen', async () => {
    await renderUi(
      <AccessibleGroup label="Vendiste en noviembre: 45.000 pesos">
        <Text>$45.000</Text>
      </AccessibleGroup>,
    );

    expect(screen.queryByText('$45.000')).not.toBeOnTheScreen();
    expect(screen.getByText('$45.000', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

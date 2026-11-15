import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CardListItem, CardListSeparator } from './card-list-item';
import { renderUi } from './testing/render-ui';

async function drawItem(isFirst: boolean, isLast: boolean) {
  await renderUi(
    <CardListItem isFirst={isFirst} isLast={isLast}>
      <Text>Fila</Text>
    </CardListItem>,
  );
  return screen.getByTestId('card-list-item');
}

describe('CardListItem', () => {
  it('draws only the side borders on a middle row', async () => {
    const item = await drawItem(false, false);

    expect(item).toHaveProp('className', expect.stringContaining('border-x-2'));
    expect(item).toHaveProp('className', expect.not.stringContaining('rounded-t-3xl'));
    expect(item).toHaveProp('className', expect.not.stringContaining('rounded-b-3xl'));
  });

  it('rounds the top of the first row', async () => {
    const item = await drawItem(true, false);

    expect(item).toHaveProp('className', expect.stringContaining('rounded-t-3xl border-t-2'));
    expect(item).toHaveProp('className', expect.not.stringContaining('rounded-b-3xl'));
  });

  it('rounds the bottom of the last row', async () => {
    const item = await drawItem(false, true);

    expect(item).toHaveProp('className', expect.stringContaining('rounded-b-3xl border-b-2'));
    expect(item).toHaveProp('className', expect.not.stringContaining('rounded-t-3xl'));
  });

  it('rounds both ends of a single row', async () => {
    const item = await drawItem(true, true);

    expect(item).toHaveProp('className', expect.stringContaining('rounded-t-3xl'));
    expect(item).toHaveProp('className', expect.stringContaining('rounded-b-3xl'));
  });

  it('shows its content', async () => {
    await drawItem(true, true);

    expect(screen.getByText('Fila')).toBeOnTheScreen();
  });
});

describe('CardListSeparator', () => {
  it('sits inside the side borders of the card', async () => {
    await renderUi(<CardListSeparator />);

    expect(screen.getByTestId('card-list-separator')).toHaveProp(
      'className',
      expect.stringContaining('border-x-2'),
    );
  });
});

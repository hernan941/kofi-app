import { screen, userEvent, within } from '@testing-library/react-native';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { AccessibilityInfo } from 'react-native';

import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('EmptyState', () => {
  it('shows the icon, the title, the sentence and the actions', async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await renderUi(
      <EmptyState
        icon={ReceiptIcon}
        title="Todavía no hay ventas esta semana"
        description="Cuando vendas algo, regístralo aquí en segundos"
        primaryAction={{ label: 'Registrar venta', onPress: onPrimary }}
        secondaryAction={{ label: 'Esta semana no vendí', onPress: onSecondary }}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Registrar venta' }));
    await user.press(screen.getByRole('button', { name: 'Esta semana no vendí' }));

    expect(
      screen.getByRole('header', { name: 'Todavía no hay ventas esta semana' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Cuando vendas algo, regístralo aquí en segundos')).toBeOnTheScreen();
    expect(
      screen.getByTestId('phosphor-react-native-receipt-duotone', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

describe('LoadingState', () => {
  it('is a busy progress indicator with a readable text', async () => {
    await renderUi(<LoadingState label="Cargando ventas" />);

    const loading = screen.getByRole('progressbar', { name: 'Cargando ventas' });

    expect(loading).toBeBusy();
  });
});

describe('scrolling of the state screens', () => {
  it('keeps the empty state and its buttons reachable with a large font', async () => {
    await renderUi(
      <EmptyState
        icon={ReceiptIcon}
        title="Todavía no hay ventas"
        description="Registra una"
        primaryAction={{ label: 'Registrar venta', onPress: jest.fn() }}
      />,
    );

    const scroll = screen.getByTestId('state-scroll');

    expect(within(scroll).getByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
  });

  it('keeps the error state and its retry button reachable with a large font', async () => {
    await renderUi(<ErrorState message="No pudimos cargar" onRetry={jest.fn()} />);

    const scroll = screen.getByTestId('state-scroll');

    expect(within(scroll).getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('explains the error, announces it and offers to retry', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onRetry = jest.fn();
    await renderUi(<ErrorState message="No pudimos cargar tus ventas" onRetry={onRetry} />);

    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('No pudimos cargar tus ventas')).toBeOnTheScreen();
    expect(
      screen.getByTestId('phosphor-react-native-warning-circle-bold', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledWith('No pudimos cargar tus ventas');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

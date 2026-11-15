import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { saleRecordIdSchema, clpSchema } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import { date, fixtureId } from '../domain/testing/sale-fixtures';
import type { SaleSavedOutcome } from '../use-cases/save-sale-record';
import { SaleSavedCelebration, type SaleSavedCelebrationProps } from './sale-saved-celebration';

const user = userEvent.setup();

const TODAY = date('2026-11-13');

const outcome = (overrides: Partial<SaleSavedOutcome> = {}): SaleSavedOutcome => ({
  kind: 'created',
  recordId: saleRecordIdSchema.parse(fixtureId(4, 1)),
  soldOn: TODAY,
  isFirstSale: false,
  clearedNoSalesWeek: null,
  ...overrides,
});

function renderCelebration(overrides: Partial<SaleSavedCelebrationProps> = {}) {
  const props: SaleSavedCelebrationProps = {
    outcome: outcome(),
    total: clpSchema.parse(45000),
    productCount: 3,
    today: TODAY,
    onDone: jest.fn(),
    ...overrides,
  };
  return { props, view: renderUi(<SaleSavedCelebration {...props} />) };
}

describe('SaleSavedCelebration', () => {
  it('celebrates a regular sale with the total, the summary and a short phrase', async () => {
    const { view } = renderCelebration();
    await view;

    expect(screen.getByRole('header', { name: /^¡Venta registrada!/ })).toBeOnTheScreen();
    expect(screen.getByText('$45.000', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Hoy, viernes 13 de noviembre · 3 productos')).toBeOnTheScreen();
    expect(screen.getByText('Ya quedó en tu historial.')).toBeOnTheScreen();
  });

  it('gives the first sale its own title and phrase', async () => {
    const { view } = renderCelebration({ outcome: outcome({ isFirstSale: true }) });
    await view;

    expect(
      screen.getByRole('header', { name: /^¡Registraste tu primera venta!/ }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Así empieza tu historial. Cada venta que anotas te ayuda a ver tu ritmo.'),
    ).toBeOnTheScreen();
  });

  it('uses the singular for a single product', async () => {
    const { view } = renderCelebration({ productCount: 1 });
    await view;

    expect(screen.getByText('Hoy, viernes 13 de noviembre · 1 producto')).toBeOnTheScreen();
  });

  it('reads the date of a past sale', async () => {
    const { view } = renderCelebration({ outcome: outcome({ soldOn: date('2026-11-12') }) });
    await view;

    expect(screen.getByText('Ayer, jueves 12 de noviembre · 3 productos')).toBeOnTheScreen();
  });

  describe('when a "no vendí" mark was removed', () => {
    it('does not mention it without a cleared week', async () => {
      const { view } = renderCelebration();
      await view;

      expect(screen.queryByText(/quitamos la marca/)).not.toBeOnTheScreen();
    });

    it('says "esta semana" for the current week', async () => {
      const { view } = renderCelebration({
        outcome: outcome({ clearedNoSalesWeek: date('2026-11-09') }),
      });
      await view;

      expect(
        screen.getByText('Como vendiste esta semana, quitamos la marca de "no vendí".'),
      ).toBeOnTheScreen();
    });

    it('says "esa semana" for another week', async () => {
      const { view } = renderCelebration({
        outcome: outcome({ soldOn: date('2026-11-05'), clearedNoSalesWeek: date('2026-11-02') }),
      });
      await view;

      expect(
        screen.getByText('Como vendiste esa semana, quitamos la marca de "no vendí".'),
      ).toBeOnTheScreen();
    });
  });

  it('finishes with the Listo button', async () => {
    const { props, view } = renderCelebration();
    await view;

    await user.press(screen.getByRole('button', { name: 'Listo' }));

    expect(props.onDone).toHaveBeenCalledTimes(1);
  });

  it('moves the focus to the title, which says the total, and does not announce apart', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { view } = renderCelebration();
    await view;

    expect(
      screen.getByRole('header', { name: '¡Venta registrada! 45.000 pesos' }),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(sendEvent.mock.calls.some(([, event]) => event === 'focus')).toBe(true);
    });
    expect(announce).not.toHaveBeenCalled();
  });

  it('reads the total once: the amount is not a second stop', async () => {
    const { view } = renderCelebration();
    await view;

    expect(screen.queryByLabelText('45.000 pesos')).not.toBeOnTheScreen();
    expect(screen.getByText('$45.000', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  describe('renderAfterSave', () => {
    it('draws nothing extra without it', async () => {
      const { view } = renderCelebration();
      await view;

      expect(screen.queryByText('Consejo')).not.toBeOnTheScreen();
    });

    it('draws what it returns, with the outcome', async () => {
      const renderAfterSave = jest.fn(() => <Text>Consejo</Text>);
      const given = outcome({ isFirstSale: true });
      const { view } = renderCelebration({ outcome: given, renderAfterSave });
      await view;

      expect(screen.getByText('Consejo')).toBeOnTheScreen();
      expect(renderAfterSave).toHaveBeenCalledWith(given, {
        focusDone: expect.any(Function) as unknown,
      });
    });

    it('lets it move the focus to the Listo button', async () => {
      const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
      let focusDone: () => void = () => undefined;
      const { view } = renderCelebration({
        renderAfterSave: (_outcome, controls) => {
          focusDone = controls.focusDone;
          return null;
        },
      });
      await view;
      await waitFor(() => {
        expect(sendEvent).toHaveBeenCalledTimes(1);
      });
      sendEvent.mockClear();

      focusDone();

      await waitFor(() => {
        expect(sendEvent).toHaveBeenCalledWith(expect.anything(), 'focus');
      });
    });
  });
});

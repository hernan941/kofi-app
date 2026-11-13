import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { localDateSchema, yearMonthSchema } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import { MonthSwitcher } from './month-switcher';

const user = userEvent.setup();
const today = localDateSchema.parse('2026-11-13');
const month = (text: string) => yearMonthSchema.parse(text);

describe('MonthSwitcher', () => {
  it('shows the month as a header', async () => {
    await renderUi(
      <MonthSwitcher
        month={month('2026-11')}
        today={today}
        navigation={{ canGoBack: true, canGoForward: false }}
        announcePrefix="Resumen de"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: 'Noviembre' })).toBeOnTheScreen();
  });

  it('names the neighbour months and moves to them', async () => {
    const onChange = jest.fn();
    await renderUi(
      <MonthSwitcher
        month={month('2026-11')}
        today={today}
        navigation={{ canGoBack: true, canGoForward: true }}
        announcePrefix="Resumen de"
        onChange={onChange}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Mes anterior, octubre' }));
    await user.press(screen.getByRole('button', { name: 'Mes siguiente, diciembre' }));

    expect(onChange).toHaveBeenNthCalledWith(1, '2026-10');
    expect(onChange).toHaveBeenNthCalledWith(2, '2026-12');
  });

  it('announces the month it moves to', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(
      <MonthSwitcher
        month={month('2026-11')}
        today={today}
        navigation={{ canGoBack: true, canGoForward: false }}
        announcePrefix="Resumen de"
        onChange={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Mes anterior, octubre' }));

    expect(announce).toHaveBeenCalledWith('Resumen de octubre');
  });

  it('disables the limits with their state and without answering to touches', async () => {
    const onChange = jest.fn();
    await renderUi(
      <MonthSwitcher
        month={month('2026-11')}
        today={today}
        navigation={{ canGoBack: false, canGoForward: false }}
        announcePrefix="Resumen de"
        onChange={onChange}
      />,
    );

    const back = screen.getByRole('button', { name: 'Mes anterior' });
    const forward = screen.getByRole('button', { name: 'Mes siguiente' });
    await user.press(back);
    await user.press(forward);

    expect(back).toBeDisabled();
    expect(forward).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('crosses the year', async () => {
    await renderUi(
      <MonthSwitcher
        month={month('2026-01')}
        today={today}
        navigation={{ canGoBack: true, canGoForward: true }}
        announcePrefix="Resumen de"
        onChange={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Mes anterior, diciembre de 2025' }),
    ).toBeOnTheScreen();
  });
});

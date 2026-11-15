import { screen, userEvent, within } from '@testing-library/react-native';

import { localDateSchema } from '@/shared/domain';

import { DatePickerSheet, type DatePickerSheetProps } from './date-picker-sheet';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

const date = (text: string) => localDateSchema.parse(text);
const TODAY = date('2026-11-13');

function renderSheet(overrides: Partial<DatePickerSheetProps> = {}) {
  const props: DatePickerSheetProps = {
    isOpen: true,
    title: '¿Qué día vendiste?',
    value: TODAY,
    maxDate: TODAY,
    today: TODAY,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return { props, view: renderUi(<DatePickerSheet {...props} />) };
}

describe('DatePickerSheet', () => {
  it('shows nothing while it is closed', async () => {
    await renderSheet({ isOpen: false }).view;

    expect(screen.queryByText('¿Qué día vendiste?')).not.toBeOnTheScreen();
  });

  it('shows the title and the month of the current value as a header', async () => {
    await renderSheet().view;

    expect(screen.getByText('¿Qué día vendiste?')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Noviembre de 2026' })).toBeOnTheScreen();
  });

  it('lists the weekday initials from Monday to Sunday', async () => {
    await renderSheet().view;

    const initials = screen
      .getAllByTestId('date-picker-weekday', { includeHiddenElements: true })
      .map((cell) =>
        String(within(cell).getByText(/./, { includeHiddenElements: true }).props.children),
      );

    expect(initials).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  it('starts the month under the right weekday, in Monday-to-Sunday rows', async () => {
    await renderSheet({ value: date('2026-04-15'), maxDate: date('2026-04-30') }).view;

    const weeks = screen.getAllByTestId('date-picker-week');
    const firstWeek = within(weeks[0] as never).getAllByRole('button');

    expect(weeks).toHaveLength(5);
    expect(firstWeek.map((day) => String(day.props.accessibilityLabel))).toEqual([
      'Miércoles 1 de abril',
      'Jueves 2 de abril',
      'Viernes 3 de abril',
      'Sábado 4 de abril',
      'Domingo 5 de abril',
    ]);
  });

  it('labels each day with the date label, saying which is chosen', async () => {
    await renderSheet({ value: date('2026-11-12') }).view;

    expect(screen.getByRole('button', { name: 'Ayer, jueves 12 de noviembre' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Hoy, viernes 13 de noviembre' })).not.toBeSelected();
  });

  it('does not let a day after maxDate be chosen', async () => {
    const { props, view } = renderSheet();
    await view;

    const tomorrow = screen.getByRole('button', { name: 'Sábado 14 de noviembre' });
    await user.press(tomorrow);

    expect(tomorrow).toBeDisabled();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('chooses a day, reports it and closes', async () => {
    const { props, view } = renderSheet();
    await view;

    await user.press(screen.getByRole('button', { name: 'Ayer, jueves 12 de noviembre' }));

    expect(props.onSelect).toHaveBeenCalledWith(date('2026-11-12'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot go to a month after the one of maxDate', async () => {
    await renderSheet().view;

    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  });

  it('goes back one month at a time and forward again', async () => {
    await renderSheet().view;

    await user.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('header', { name: 'Octubre de 2026' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('header', { name: 'Noviembre de 2026' })).toBeOnTheScreen();
  });

  it('crosses the year going back', async () => {
    await renderSheet({
      value: date('2026-01-10'),
      today: date('2026-01-10'),
      maxDate: date('2026-01-10'),
    }).view;

    await user.press(screen.getByRole('button', { name: 'Mes anterior' }));

    expect(screen.getByRole('header', { name: 'Diciembre de 2025' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Miércoles 31 de diciembre de 2025' })).toBeEnabled();
  });

  it('has no minimum date: it keeps going back for years', async () => {
    await renderSheet().view;

    for (let step = 0; step < 14; step += 1) {
      await user.press(screen.getByRole('button', { name: 'Mes anterior' }));
    }

    expect(screen.getByRole('header', { name: 'Septiembre de 2025' })).toBeOnTheScreen();
  });

  it('closes from the close button', async () => {
    const { props, view } = renderSheet();
    await view;

    await user.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('has flexible cells, with no fixed size, so seven columns fit a narrow screen', async () => {
    await renderSheet().view;

    const cell = screen.getByRole('button', { name: 'Hoy, viernes 13 de noviembre' });
    const [weekday] = screen.getAllByTestId('date-picker-weekday', { includeHiddenElements: true });

    expect(cell).toHaveProp('className', expect.not.stringContaining('size-12'));
    expect(cell).toHaveProp('className', expect.stringContaining('flex-1'));
    expect(weekday).toHaveProp('className', expect.not.stringContaining('size-12'));
  });

  it('caps the font scale of the day number at 2 and keeps the full label', async () => {
    await renderSheet().view;

    expect(screen.getByText('13')).toHaveProp('maxFontSizeMultiplier', 2);
    expect(screen.getByRole('button', { name: 'Hoy, viernes 13 de noviembre' })).toBeOnTheScreen();
  });
});

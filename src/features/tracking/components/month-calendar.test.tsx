import { screen, userEvent } from '@testing-library/react-native';
import { renderUi } from '@/shared/ui/testing/render-ui';
import { yearMonthSchema } from '@/shared/domain';

import { buildCalendarMonth } from '../domain';
import { day, saleOf } from '../domain/testing/tracking-fixtures';
import { noSalesWeekOf } from '@/features/sales/domain';
import { MonthCalendar } from './month-calendar';

const user = userEvent.setup();
const november = yearMonthSchema.parse('2026-11');
const today = day('2026-11-12');

function mark(weekStart: string) {
  const result = noSalesWeekOf(day(weekStart));
  if (!result.ok) throw new Error('Monday expected');
  return result.value;
}

async function showCalendar(
  records = [saleOf('2026-11-12', 45000), saleOf('2026-11-12', 1000)],
  marks = [mark('2026-11-02')],
) {
  const onOpenDay = jest.fn();
  const calendar = buildCalendarMonth(november, today, records, marks);
  await renderUi(<MonthCalendar calendar={calendar} onOpenDay={onOpenDay} />);
  return onOpenDay;
}

describe('MonthCalendar', () => {
  it('labels each day with its date and what was sold', async () => {
    await showCalendar();

    expect(
      screen.getByRole('button', { name: 'Hoy, 12 de noviembre, 46.000 pesos, 2 ventas' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '11 de noviembre, sin ventas' })).toBeOnTheScreen();
  });

  it('opens the day when it is pressed', async () => {
    const onOpenDay = await showCalendar();

    await user.press(screen.getByRole('button', { name: '10 de noviembre, sin ventas' }));

    expect(onOpenDay).toHaveBeenCalledWith('2026-11-10');
  });

  it('disables the future days and does not open them', async () => {
    const onOpenDay = await showCalendar();
    const future = screen.getByLabelText('20 de noviembre, no disponible');

    expect(future).toBeDisabled();
    await user.press(future);

    expect(onOpenDay).not.toHaveBeenCalled();
  });

  it('shows the intensity as one to three dots', async () => {
    await showCalendar([
      saleOf('2026-11-03', 9000),
      saleOf('2026-11-04', 4500),
      saleOf('2026-11-05', 1000),
    ]);

    expect(screen.getAllByTestId('intensity-3')).toHaveLength(1);
    expect(screen.getByTestId('intensity-3').children).toHaveLength(3);
    expect(screen.getByTestId('intensity-2').children).toHaveLength(2);
    expect(screen.getByTestId('intensity-1').children).toHaveLength(1);
  });

  it('leaves the filler days empty and not pressable', async () => {
    await showCalendar();

    expect(screen.queryByText('31')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/^31 de octubre/)).not.toBeOnTheScreen();
    expect(screen.getByText('1', { exact: true })).toBeOnTheScreen();
  });

  it('hides the filler days from every screen reader', async () => {
    await showCalendar();

    const hidden = screen.container.queryAll(
      (node) =>
        node.props.accessibilityElementsHidden === true &&
        node.props.importantForAccessibility === 'no-hide-descendants' &&
        node.children.length === 0 &&
        node.type === 'View',
    );
    const fillerDays = 6 + 6;

    expect(hidden).toHaveLength(fillerDays);
  });

  it('writes the marked week under its row and in its days', async () => {
    await showCalendar();

    expect(screen.getAllByText('Semana marcada como "no vendí"')).toHaveLength(1);
    expect(
      screen.getByRole('button', {
        name: '3 de noviembre, sin ventas, semana marcada como no vendí',
      }),
    ).toBeOnTheScreen();
  });
});

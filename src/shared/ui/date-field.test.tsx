import { screen, userEvent } from '@testing-library/react-native';

import { localDateSchema } from '@/shared/domain';

import { DateField } from './date-field';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

const date = (text: string) => localDateSchema.parse(text);
const TODAY = date('2026-11-13');

describe('DateField', () => {
  it('does not allow a date after maxDate', async () => {
    const onChange = jest.fn();
    await renderUi(
      <DateField label="Fecha" value={TODAY} maxDate={TODAY} today={TODAY} onChange={onChange} />,
    );

    const next = screen.getByRole('button', { name: 'Día siguiente' });
    await user.press(next);

    expect(next).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves one day at a time up to maxDate', async () => {
    const onChange = jest.fn();
    await renderUi(
      <DateField
        label="Fecha"
        value={date('2026-11-12')}
        maxDate={TODAY}
        today={TODAY}
        onChange={onChange}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Día siguiente' }));
    await user.press(screen.getByRole('button', { name: 'Día anterior' }));

    expect(onChange).toHaveBeenNthCalledWith(1, TODAY);
    expect(onChange).toHaveBeenNthCalledWith(2, date('2026-11-11'));
  });

  it('reads the label together with the chosen date', async () => {
    await renderUi(
      <DateField label="Fecha" value={TODAY} maxDate={TODAY} today={TODAY} onChange={jest.fn()} />,
    );

    expect(screen.getByLabelText('Fecha: Hoy, viernes 13 de noviembre')).toBeOnTheScreen();
  });

  it('does not allow a date before minDate', async () => {
    const onChange = jest.fn();
    const minDate = date('2026-11-01');
    await renderUi(
      <DateField
        label="Fecha"
        value={minDate}
        minDate={minDate}
        maxDate={TODAY}
        onChange={onChange}
      />,
    );

    const previous = screen.getByRole('button', { name: 'Día anterior' });
    await user.press(previous);

    expect(previous).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

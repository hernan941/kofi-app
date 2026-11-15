import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import type { WeeklyReminderValue } from './weekly-reminder-fields';
import { WeeklyReminderSheet } from './weekly-reminder-sheet';

/** Dispara un evento y espera a que React lo aplique (en RNTL 14 `fireEvent` devuelve una promesa). */
async function settle(pending: Promise<unknown>) {
  await pending;
}

const user = userEvent.setup();

function firstCloseButton() {
  const [button] = screen.getAllByRole('button', { name: 'Cerrar' });
  if (button === undefined) {
    throw new Error('The sheet has no close button.');
  }
  return button;
}

async function setup(weekly: WeeklyReminderValue = { weekday: 7, minuteOfDay: 1200 }) {
  const onSave = jest.fn();
  const onClose = jest.fn();
  await renderUi(<WeeklyReminderSheet isOpen weekly={weekly} onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
}

describe('WeeklyReminderSheet', () => {
  it('opens with the saved day and time', async () => {
    await setup();

    expect(screen.getByRole('header', { name: 'Día y hora del recordatorio' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Domingo' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '00' })).toBeChecked();
    expect(screen.getByRole('adjustable', { name: 'Hora' })).toHaveDisplayValue('20');
    expect(screen.getByText('Te avisamos los domingos a las 20:00.')).toBeOnTheScreen();
  });

  it('lists the days from Monday to Sunday and the four minute options', async () => {
    await setup();

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    for (const day of days) {
      expect(screen.getByRole('radio', { name: day })).toBeOnTheScreen();
    }
    for (const minutes of ['00', '15', '30', '45']) {
      expect(screen.getByRole('radio', { name: minutes })).toBeOnTheScreen();
    }
  });

  it('updates the summary and saves day and minute of day together', async () => {
    const { onSave } = await setup();

    await user.press(screen.getByRole('radio', { name: 'Martes' }));
    const hour = screen.getByRole('adjustable', { name: 'Hora' });
    await settle(fireEvent.changeText(hour, '8'));
    await user.press(screen.getByRole('radio', { name: '30' }));

    expect(screen.getByText('Te avisamos los martes a las 8:30.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith({ weekday: 2, minuteOfDay: 510 });
  });

  it('shows the real minute, with no chip chosen, when the saved one is not offered', async () => {
    await setup({ weekday: 1, minuteOfDay: 8 * 60 + 10 });

    for (const minutes of ['00', '15', '30', '45']) {
      expect(screen.getByRole('radio', { name: minutes })).not.toBeChecked();
    }
    expect(screen.getByText('Te avisamos los lunes a las 8:10.')).toBeOnTheScreen();
  });

  it('closes without saving when dismissed', async () => {
    const { onSave, onClose } = await setup();

    await user.press(firstCloseButton());

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

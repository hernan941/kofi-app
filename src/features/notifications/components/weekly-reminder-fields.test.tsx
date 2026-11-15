import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { WeeklyReminderFields, type WeeklyReminderValue } from './weekly-reminder-fields';

const user = userEvent.setup();

function Harness() {
  const [value, setValue] = useState<WeeklyReminderValue>({ weekday: 7, minuteOfDay: 1200 });
  return <WeeklyReminderFields value={value} onChange={setValue} />;
}

describe('WeeklyReminderFields announcements', () => {
  it('stays silent on the first render', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await renderUi(<Harness />);

    expect(announce).not.toHaveBeenCalled();
  });

  it('announces the new summary once after a short delay, and has no live region', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(<Harness />);

    await user.press(screen.getByRole('radio', { name: 'Martes' }));
    expect(announce).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Te avisamos los martes a las 20:00.');
    expect(
      screen.getByText('Te avisamos los martes a las 20:00.').props.accessibilityLiveRegion,
    ).toBeUndefined();
  });

  it('reads the hour as text, like "20 horas"', async () => {
    await renderUi(<Harness />);

    expect(screen.getByRole('adjustable', { name: 'Hora' })).toHaveProp(
      'accessibilityValue',
      expect.objectContaining({ now: 20, text: '20 horas' }),
    );
  });
});

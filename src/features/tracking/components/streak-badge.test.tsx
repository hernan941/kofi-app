import { screen } from '@testing-library/react-native';

import type { Streak } from '@/features/sales/domain';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { renderUi } from '@/shared/ui/testing/render-ui';
import { localDateSchema } from '@/shared/domain';

import { StreakBadge } from './streak-badge';

const MONDAY = localDateSchema.parse('2026-06-01');

function streakOf(weeks: number, includesCurrentWeek = true): Streak {
  return { weeks, includesCurrentWeek, oldestWeekStart: weeks === 0 ? null : MONDAY };
}

describe('StreakBadge compact', () => {
  it('shows the weeks in a row', async () => {
    await renderUi(<StreakBadge streak={streakOf(4)} variant="compact" />);

    expect(screen.getByLabelText('Racha: 4 semanas seguidas registrando.')).toBeOnTheScreen();
    expect(screen.getByText('4 semanas seguidas registrando')).toBeOnTheScreen();
  });

  it('uses the singular for one week', async () => {
    await renderUi(<StreakBadge streak={streakOf(1)} variant="compact" />);

    expect(screen.getByLabelText('Racha: 1 semana registrando.')).toBeOnTheScreen();
    expect(screen.getByText('1 semana registrando')).toBeOnTheScreen();
  });

  it('draws nothing at zero weeks', async () => {
    await renderUi(<StreakBadge streak={streakOf(0)} variant="compact" />);

    expect(screen.queryByText(/./)).not.toBeOnTheScreen();
  });
});

describe('StreakBadge full', () => {
  it('explains how a streak starts at zero without blame', async () => {
    await renderUi(<StreakBadge streak={streakOf(0, false)} variant="full" />);

    const title = screen.getByText('Tu racha empieza cuando registras una semana');
    expect(title).toBeOnTheScreen();
    expect(
      screen.getByText('Cuenta las semanas en que anotas ventas o marcas "no vendí".'),
    ).toBeOnTheScreen();
    expect(findGuiltPattern(String(title.props.children))).toBeNull();
  });

  it('says the week still adds when the current one is not registered yet', async () => {
    await renderUi(<StreakBadge streak={streakOf(3, false)} variant="full" />);

    expect(screen.getByText('3 semanas seguidas')).toBeOnTheScreen();
    expect(
      screen.getByText('Esta semana suma cuando registres una venta o marques "no vendí".'),
    ).toBeOnTheScreen();
  });

  it('says what counts when the current week is registered', async () => {
    await renderUi(<StreakBadge streak={streakOf(1)} variant="full" />);

    expect(screen.getByText('1 semana')).toBeOnTheScreen();
    expect(screen.getByText('Semanas registrando, con ventas o con "no vendí".')).toBeOnTheScreen();
  });
});

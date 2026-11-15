import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { DayDetailScreen } from '@/features/tracking';
import { localDateSchema } from '@/shared/domain';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ date: localDateSchema });

/**
 * Detail of a day (`/tracking/day/YYYY-MM-DD`): an invalid date shows the not-found screen. A
 * valid future date is shown without the option to register. Registering opens the sale form
 * on that date and closing the celebration comes back here.
 */
export default function DayDetailRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  if (!params.ok) {
    return (
      <NotFoundScreen
        onGoHome={() => {
          router.replace('/');
        }}
      />
    );
  }
  return (
    <DayDetailScreen
      date={params.value.date}
      onBack={() => {
        goBackOrHome(router);
      }}
      onOpenSale={(id) => {
        router.push({ pathname: '/sales/[id]', params: { id } });
      }}
      onRegisterSale={(date) => {
        router.push({ pathname: '/sales/new', params: { date } });
      }}
    />
  );
}

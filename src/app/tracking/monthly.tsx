import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { MonthlySummaryScreen } from '@/features/tracking';
import { yearMonthSchema } from '@/shared/domain';
import { parseRouteParams } from '@/shared/lib/route-params';

const paramsSchema = z.object({ month: yearMonthSchema.optional() });

/**
 * Monthly summary (`/tracking/monthly?month=YYYY-MM`), destination of the monthly notice. The
 * visible month lives in the URL. An invalid or repeated `month` redirects to the current
 * month; changing the month replaces the parameter instead of stacking screens.
 */
export default function MonthlySummaryRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  if (!params.ok) {
    return <Redirect href="/tracking/monthly" />;
  }
  return (
    <MonthlySummaryScreen
      requestedMonth={params.value.month ?? null}
      onChangeMonth={(month) => {
        router.setParams({ month });
      }}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}
    />
  );
}

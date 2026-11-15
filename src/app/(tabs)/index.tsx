import { useRouter } from 'expo-router';

import { HomeScreen } from '@/features/tracking';
import { perfMark } from '@/shared/lib/perf-marks';

/** Home tab: renders the tracking feature's home screen. */
export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onRegisterSale={() => {
        if (process.env.EXPO_PUBLIC_E2E === '1') {
          perfMark('sale-form:press');
        }
        router.push('/sales/new');
      }}
      onOpenSale={(id) => {
        router.push({ pathname: '/sales/[id]', params: { id } });
      }}
      onOpenMonthlySummary={() => {
        router.push('/tracking/monthly');
      }}
    />
  );
}

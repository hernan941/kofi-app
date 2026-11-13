import { useRouter } from 'expo-router';

import { HomeScreen } from '@/features/tracking';

/** Home tab: renders the tracking feature's home screen. */
export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onRegisterSale={() => {
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

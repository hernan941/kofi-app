import { useRouter } from 'expo-router';

import { CalendarScreen } from '@/features/tracking';

/** Calendar tab: renders the tracking feature's calendar screen and opens the day detail. */
export default function CalendarRoute() {
  const router = useRouter();
  return (
    <CalendarScreen
      onOpenDay={(date) => {
        router.push({ pathname: '/tracking/day/[date]', params: { date } });
      }}
    />
  );
}

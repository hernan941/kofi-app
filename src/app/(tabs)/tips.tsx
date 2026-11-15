import { useRouter } from 'expo-router';

import { TipsScreen } from '@/features/tips';

/** Tips tab: the list of tips; opening one goes to its read-only detail. */
export default function TipsRoute() {
  const router = useRouter();
  return (
    <TipsScreen
      onOpenTip={(id) => {
        router.push({ pathname: '/tips/[id]', params: { id } });
      }}
    />
  );
}

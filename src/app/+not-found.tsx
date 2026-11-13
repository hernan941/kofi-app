import { useRouter } from 'expo-router';

import { NotFoundScreen } from '@/shared/ui';

/** Unknown URL: renders the not-found screen, whose action goes back to the home tab. */
export default function NotFoundRoute() {
  const router = useRouter();
  return (
    <NotFoundScreen
      onGoHome={() => {
        router.replace('/');
      }}
    />
  );
}

import { useRouter } from 'expo-router';

import { PermissionIntroScreen } from '@/features/notifications';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';

/**
 * Explanation shown once, after "Listo" on the first sale (D-06). It replaces the sale form, so
 * leaving it, with either button, the back button or the close gesture, lands on Inicio.
 */
export default function NotificationIntroRoute() {
  const router = useRouter();
  return (
    <PermissionIntroScreen
      onFinished={() => {
        goBackOrHome(router);
      }}
    />
  );
}

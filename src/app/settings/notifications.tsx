import { useRouter } from 'expo-router';

import { NotificationSettingsScreen } from '@/features/notifications';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';

/** Reminder preferences (`/settings/notifications`), a stacked screen with its own header. */
export default function NotificationSettingsRoute() {
  const router = useRouter();
  return (
    <NotificationSettingsScreen
      onBack={() => {
        goBackOrHome(router);
      }}
    />
  );
}

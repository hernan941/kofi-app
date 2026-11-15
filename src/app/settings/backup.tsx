import { useRouter } from 'expo-router';

import { BackupScreen } from '@/features/backup';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';

/** Respaldo (`/settings/backup`), a stacked screen with its own header. */
export default function BackupRoute() {
  const router = useRouter();
  return (
    <BackupScreen
      onBack={() => {
        goBackOrHome(router);
      }}
      onGoHome={() => {
        router.dismissTo('/');
      }}
    />
  );
}

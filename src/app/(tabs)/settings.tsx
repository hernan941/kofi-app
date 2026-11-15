import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/features/settings';

/** Settings tab: renders the settings feature's screen. */
export default function SettingsRoute() {
  const router = useRouter();
  return (
    <SettingsScreen
      onOpenNotifications={() => {
        router.push('/settings/notifications');
      }}
      onOpenBackup={() => {
        router.push('/settings/backup');
      }}
      onOpenLicenses={() => {
        router.push('/settings/licenses');
      }}
    />
  );
}

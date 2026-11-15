import { useRouter } from 'expo-router';

import { LicensesScreen } from '@/features/settings';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';

/** Third-party licenses (`/settings/licenses`), a stacked screen with its own header. */
export default function LicensesRoute() {
  const router = useRouter();
  return (
    <LicensesScreen
      onBack={() => {
        goBackOrHome(router);
      }}
      onOpenNotice={(id) => {
        router.push({ pathname: '/settings/licenses/[id]', params: { id } });
      }}
    />
  );
}

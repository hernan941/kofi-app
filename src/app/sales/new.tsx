import { useRouter } from 'expo-router';

import { NewSaleScreen } from '@/features/sales';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';

/**
 * Register a sale: destination of the "Registrar venta" button and of the reminder
 * (`/sales/new`). When the celebration closes it goes back, or to the start when the screen
 * was opened by a deep link and there is nothing to go back to. The after-sale flow
 * (tip, notification permission) hooks in here through `renderAfterSave` and `onFinished`.
 */
export default function NewSaleRoute() {
  const router = useRouter();
  return (
    <NewSaleScreen
      onCancel={() => {
        goBackOrHome(router);
      }}
      onCreateProduct={() => {
        router.push({ pathname: '/products/new', params: { from: 'sale' } });
      }}
      onFinished={() => {
        goBackOrHome(router);
      }}
    />
  );
}

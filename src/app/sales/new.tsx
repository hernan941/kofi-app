import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { shouldOfferPermission, useNotificationPermission } from '@/features/notifications';
import { NewSaleScreen } from '@/features/sales';
import { AfterSaleTip } from '@/features/tips';
import { localDateSchema } from '@/shared/domain';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';
import { parseRouteParams } from '@/shared/lib/route-params';

const paramsSchema = z.object({ date: localDateSchema.optional() });

/**
 * Register a sale: destination of the "Registrar venta" button and of the reminder
 * (`/sales/new`). When the celebration closes it goes back, or to the start when the screen
 * was opened by a deep link and there is nothing to go back to. The after-sale flow hooks in
 * here: the tip goes in the celebration through `renderAfterSave`, only for new sales, and the
 * notification permission explanation follows `onFinished` (D-06): only after the first sale
 * and only while the permission is still undecided, so it never competes with the tip.
 * The optional `date` parameter (`/sales/new?date=YYYY-MM-DD`) sets the day of the sale; an
 * invalid one is ignored and the screen ignores a future one.
 */
export default function NewSaleRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  const { permission } = useNotificationPermission();
  return (
    <NewSaleScreen
      initialSoldOn={params.ok ? params.value.date : undefined}
      onCancel={() => {
        goBackOrHome(router);
      }}
      onCreateProduct={() => {
        router.push({ pathname: '/products/new', params: { from: 'sale' } });
      }}
      renderAfterSave={(outcome, controls) =>
        outcome.kind === 'created' ? (
          <AfterSaleTip
            recordId={outcome.recordId}
            isFirstSale={outcome.isFirstSale}
            onClosed={controls.focusDone}
          />
        ) : null
      }
      onFinished={(outcome) => {
        if (shouldOfferPermission({ isFirstSale: outcome.isFirstSale, permission })) {
          router.replace('/notifications/intro');
        } else {
          goBackOrHome(router);
        }
      }}
    />
  );
}

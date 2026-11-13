import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { EditSaleScreen } from '@/features/sales';
import { saleRecordIdSchema } from '@/shared/domain';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ id: saleRecordIdSchema });

/**
 * Edit a sale: an invalid id shows the not-found screen. Saving goes back to the detail;
 * deleting (removing every product) goes back two levels, to where the detail was opened.
 */
export default function EditSaleRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  if (!params.ok) {
    return (
      <NotFoundScreen
        onGoHome={() => {
          router.replace('/');
        }}
      />
    );
  }
  return (
    <EditSaleScreen
      saleRecordId={params.value.id}
      onCancel={() => {
        goBackOrHome(router);
      }}
      onSaved={() => {
        router.back();
      }}
      onDeleted={() => {
        router.dismiss(2);
      }}
    />
  );
}

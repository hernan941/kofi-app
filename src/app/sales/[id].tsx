import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { SaleDetailScreen } from '@/features/sales';
import { saleRecordIdSchema } from '@/shared/domain';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ id: saleRecordIdSchema });

/** Sale detail: an invalid id shows the not-found screen. */
export default function SaleDetailRoute() {
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
  const { id } = params.value;
  return (
    <SaleDetailScreen
      saleRecordId={id}
      onBack={() => {
        goBackOrHome(router);
      }}
      onEdit={() => {
        router.push({ pathname: '/sales/[id]/edit', params: { id } });
      }}
      onDeleted={() => {
        goBackOrHome(router);
      }}
    />
  );
}

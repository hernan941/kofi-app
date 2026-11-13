import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { EditProductScreen } from '@/features/products';
import { productIdSchema } from '@/shared/domain';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ id: productIdSchema });

/** Edit product: an invalid id shows the not-found screen; saving goes back to the detail. */
export default function EditProductRoute() {
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
    <EditProductScreen
      productId={params.value.id}
      onBack={() => {
        router.back();
      }}
      onSaved={() => {
        router.back();
      }}
    />
  );
}

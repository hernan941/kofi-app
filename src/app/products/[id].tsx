import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { ProductDetailScreen } from '@/features/products';
import { productIdSchema } from '@/shared/domain';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ id: productIdSchema });

/** Product detail: an invalid id shows the not-found screen. */
export default function ProductDetailRoute() {
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
    <ProductDetailScreen
      productId={id}
      onBack={() => {
        router.back();
      }}
      onEdit={() => {
        router.push({ pathname: '/products/[id]/edit', params: { id } });
      }}
      onArchived={() => {
        router.back();
      }}
    />
  );
}

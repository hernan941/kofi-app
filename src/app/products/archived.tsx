import { useRouter } from 'expo-router';

import { ArchivedProductsScreen } from '@/features/products';

/** Archived products; the static route wins over `[id]`. */
export default function ArchivedProductsRoute() {
  const router = useRouter();
  return (
    <ArchivedProductsScreen
      onBack={() => {
        router.back();
      }}
      onOpenProduct={(id) => {
        router.push({ pathname: '/products/[id]', params: { id } });
      }}
    />
  );
}

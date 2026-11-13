import { useRouter } from 'expo-router';

import { ProductsScreen } from '@/features/products';

/** Products tab: renders the list and sends the person to create, open or see archived products. */
export default function ProductsRoute() {
  const router = useRouter();
  return (
    <ProductsScreen
      onAddProduct={() => {
        router.push('/products/new');
      }}
      onOpenProduct={(id) => {
        router.push({ pathname: '/products/[id]', params: { id } });
      }}
      onOpenArchived={() => {
        router.push('/products/archived');
      }}
    />
  );
}

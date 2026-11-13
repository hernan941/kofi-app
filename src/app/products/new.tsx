import { useRouter } from 'expo-router';

import { NewProductScreen } from '@/features/products';

/** Create product: goes back to the list when it is saved. */
export default function NewProductRoute() {
  const router = useRouter();
  return (
    <NewProductScreen
      onBack={() => {
        router.back();
      }}
      onSaved={() => {
        router.back();
      }}
    />
  );
}

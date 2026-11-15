import { NOTIFICATIONS_QUERY_DEPENDENCIES } from '@/features/notifications';
import { PRODUCTS_QUERY_DEPENDENCIES } from '@/features/products';
import { SALES_QUERY_DEPENDENCIES } from '@/features/sales';
import { TRACKING_QUERY_DEPENDENCIES } from '@/features/tracking';
import { TIPS_QUERY_DEPENDENCIES } from '@/features/tips';

import type { QueryDependency } from './root-keys-to-invalidate';

/**
 * Registro de las raíces de query keys de todas las features y las tablas de las que
 * dependen. Cada feature agrega la suya al exponerla por su `index.ts`.
 */
export const QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  ...PRODUCTS_QUERY_DEPENDENCIES,
  ...SALES_QUERY_DEPENDENCIES,
  ...TRACKING_QUERY_DEPENDENCIES,
  ...TIPS_QUERY_DEPENDENCIES,
  ...NOTIFICATIONS_QUERY_DEPENDENCIES,
];

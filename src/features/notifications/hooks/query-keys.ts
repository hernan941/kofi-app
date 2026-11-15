import type { QueryDependency } from '@/core/providers/query/root-keys-to-invalidate';

/** Claves de consulta de la feature; solo `preferences` depende de una tabla. */
export const notificationKeys = {
  preferences: () => ['notification-preferences'] as const,
  permission: () => ['notification-permission'] as const,
};

/**
 * `notification-preferences` depende de `notification_preferences`. El permiso viene del
 * sistema, no de la base: se registra sin tablas y se relee al volver a primer plano.
 */
export const NOTIFICATIONS_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['notification-preferences'], tables: new Set(['notification_preferences']) },
  { rootKey: ['notification-permission'], tables: new Set() },
];

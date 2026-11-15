import type { NotificationPermission } from './ports';

/** Decide si la ruta posventa muestra la pantalla explicativa (D-06, D-36). */
export function shouldOfferPermission(input: {
  readonly isFirstSale: boolean;
  readonly permission: NotificationPermission | undefined;
}): boolean {
  return input.isFirstSale && input.permission === 'undetermined';
}

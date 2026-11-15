import type { ImperativeRouter } from 'expo-router';

import type { NotificationTarget } from '../domain/payload';

/**
 * Navega al destino de un aviso tocado: el registro de venta, el resumen del mes que indica
 * el aviso, o Inicio si el payload no era válido (ADR-010).
 */
export function openNotificationTarget(
  router: Pick<ImperativeRouter, 'push' | 'navigate'>,
  target: NotificationTarget | null,
): void {
  if (target === null) {
    router.navigate('/');
    return;
  }
  if (target.deepLink === '/sales/new') {
    router.push('/sales/new');
    return;
  }
  router.push({ pathname: '/tracking/monthly', params: { month: target.month } });
}

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';

import { touchesReconcileTables } from '../domain/reconcile-tables';

/**
 * Pide la reconciliación de avisos (ADR-011) al montarse, al volver a primer plano (cubre el
 * cambio de zona horaria y del permiso en los ajustes del sistema) y cuando cambian las
 * tablas que alteran el plan. Quita sus oyentes al desmontarse.
 */
export function useNotificationTriggers(): void {
  const { notificationReconciler, dataChanges } = useDependencies();
  useEffect(() => {
    const request = () => {
      void notificationReconciler.request();
    };
    request();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        request();
      }
    });
    const unsubscribe = dataChanges.subscribe((tables) => {
      if (touchesReconcileTables(tables)) {
        request();
      }
    });
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, [notificationReconciler, dataChanges]);
}

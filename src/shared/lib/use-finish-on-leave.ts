import { usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

/**
 * Hace que salir de una pantalla equivalga a terminar (la celebración de una venta): mientras
 * `isActive`, el botón de volver, el gesto de iOS y el botón atrás de Android no salen, sino
 * que llaman a `onFinish`. Así el flujo de después de guardar (consejo, pedido de permiso)
 * nunca se salta. `onFinish` corre una sola vez y después de soltar el bloqueo, para que la
 * navegación que haga no vuelva a ser interceptada. Devuelve la función de terminar, para el
 * botón "Listo".
 */
export function useFinishOnLeave(isActive: boolean, onFinish: () => void): () => void {
  const [isReleased, setIsReleased] = useState(false);
  const latestOnFinish = useRef(onFinish);
  useEffect(() => {
    latestOnFinish.current = onFinish;
  }, [onFinish]);

  const finish = () => {
    setIsReleased(true);
  };

  usePreventRemove(isActive && !isReleased, finish);

  useEffect(() => {
    if (isReleased) {
      latestOnFinish.current();
    }
  }, [isReleased]);

  return finish;
}

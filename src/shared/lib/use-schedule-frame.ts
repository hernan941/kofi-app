import { useCallback, useEffect, useRef } from 'react';

/**
 * Devuelve una función que ejecuta un trabajo en el siguiente cuadro (`requestAnimationFrame`)
 * y cancela al desmontar los cuadros que sigan pendientes, para no tocar elementos de una
 * pantalla que ya no existe.
 */
export function useScheduleFrame(): (work: () => void) => void {
  const pending = useRef(new Set<number>());

  useEffect(() => {
    const frames = pending.current;
    return () => {
      frames.forEach((frame) => {
        cancelAnimationFrame(frame);
      });
      frames.clear();
    };
  }, []);

  return useCallback((work) => {
    const frame = requestAnimationFrame(() => {
      pending.current.delete(frame);
      work();
    });
    pending.current.add(frame);
  }, []);
}

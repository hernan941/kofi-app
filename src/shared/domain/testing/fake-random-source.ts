import type { RandomSource } from '../ids';

/** Fuente aleatoria fija para probar el generador UUIDv7: devuelve siempre una copia de `bytes`. */
export function fakeRandomSource(bytes: Uint8Array): RandomSource {
  return () => Uint8Array.from(bytes);
}

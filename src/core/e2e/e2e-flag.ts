/** Interpreta el valor de `EXPO_PUBLIC_E2E`: solo `'1'` habilita lo de E2E (ADR-013). */
export function isE2EFlag(value: string | undefined): boolean {
  return value === '1';
}

/**
 * `true` solo en el build `e2e` (`EXPO_PUBLIC_E2E=1`, ADR-016). Sirve para decisiones que no
 * cargan código de E2E, como reescribir enlaces entrantes en `+native-intent`. No sirve para
 * decidir un `require` de código E2E: Metro solo elimina la rama muerta si la condición es
 * literalmente `process.env.EXPO_PUBLIC_E2E === '1'`, así que las rutas que cargan
 * `@/features/e2e` leen la variable en línea dentro del `if` (ver `src/app/e2e/diagnostics.tsx`).
 */
export const isE2EBuild: boolean = isE2EFlag(process.env.EXPO_PUBLIC_E2E);

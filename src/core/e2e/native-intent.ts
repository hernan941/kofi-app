const E2E_PATH = /^(?:[a-z][a-z0-9+.-]*:)?\/*e2e(?:[/?#]|$)/i;

/**
 * Decide a dónde lleva un enlace entrante (`+native-intent`). Sin el flag de E2E, cualquier
 * `cuantovendi://e2e/**` se reescribe a Inicio para que las rutas de prueba no se alcancen
 * desde un build normal (ADR-013); con el flag, la ruta se deja intacta.
 */
export function resolveNativeIntentPath(path: string, e2eEnabled: boolean): string {
  return !e2eEnabled && E2E_PATH.test(path) ? '/' : path;
}

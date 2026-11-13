/**
 * Ejecuta un trabajo síncrono y entrega su resultado como promesa: si lanza, la promesa se
 * rechaza en vez de propagar la excepción al llamador. Lo usan los métodos asíncronos de los
 * repositorios, que envuelven código síncrono.
 */
export function runAsPromise<T>(work: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(work());
  });
}

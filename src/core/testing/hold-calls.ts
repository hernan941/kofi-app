type AsyncMethodKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => Promise<unknown> ? K : never;
}[keyof T];

/**
 * Retiene las llamadas a un método asíncrono de un doble hasta que se llame a la función
 * devuelta; después ejecutan el método real. Sirve para afirmar un estado pendiente de forma
 * determinista: mientras no se libera, la consulta no puede resolverse.
 */
export function holdCalls<T extends object>(
  target: T,
  method: AsyncMethodKeys<T> & string,
): () => void {
  type Method = (...args: unknown[]) => Promise<unknown>;
  const original = (target[method] as Method).bind(target);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  jest
    .spyOn(target, method as never)
    .mockImplementation(((...args: unknown[]) => gate.then(() => original(...args))) as never);
  return release;
}

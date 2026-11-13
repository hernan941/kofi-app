/** Contexto estructurado opcional de un evento. */
export type LogContext = Readonly<Record<string, unknown>>;

/**
 * Registro de eventos técnicos. En la v1 escribe en consola solo en desarrollo y no hace
 * nada en builds de release. El destino externo es futuro, fuera de la v1 (D-23).
 */
export interface Logger {
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, error: unknown, context?: LogContext): void;
}

/** Variante que no escribe en ningún lado, para los builds de release. */
const SILENT_LOGGER: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Variante que escribe en la consola; es la única parte de la app que usa `console`. */
const CONSOLE_LOGGER: Logger = {
  info: (event, ...context) => {
    console.info(event, ...context);
  },
  warn: (event, ...context) => {
    console.warn(event, ...context);
  },
  error: (event, error, ...context) => {
    console.error(event, error, ...context);
  },
};

/**
 * Crea el logger de la app. Con `isDevelopment` en falso (release) no escribe nada.
 * Es el único archivo exento de `no-console` (ADR-013).
 */
export function createLogger(isDevelopment: boolean = __DEV__): Logger {
  return isDevelopment ? CONSOLE_LOGGER : SILENT_LOGGER;
}

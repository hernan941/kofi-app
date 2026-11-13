import type { LogContext, Logger } from '../logger';

/** Nivel de un evento registrado. */
export type LogLevel = 'info' | 'warn' | 'error';

/** Evento guardado por {@link RecordingLogger}. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly event: string;
  readonly error?: unknown;
  readonly context?: LogContext;
}

/** Logger de test que guarda los eventos en memoria para verificarlos. */
export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];

  info(event: string, context?: LogContext): void {
    this.entries.push(
      context === undefined ? { level: 'info', event } : { level: 'info', event, context },
    );
  }

  warn(event: string, context?: LogContext): void {
    this.entries.push(
      context === undefined ? { level: 'warn', event } : { level: 'warn', event, context },
    );
  }

  error(event: string, error: unknown, context?: LogContext): void {
    this.entries.push(
      context === undefined
        ? { level: 'error', event, error }
        : { level: 'error', event, error, context },
    );
  }

  /** Eventos registrados con un nivel. */
  entriesAt(level: LogLevel): readonly LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }
}

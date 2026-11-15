import { Lexend_400Regular } from '@expo-google-fonts/lexend/400Regular';
import { Lexend_500Medium } from '@expo-google-fonts/lexend/500Medium';
import { Lexend_600SemiBold } from '@expo-google-fonts/lexend/600SemiBold';
import { Lexend_700Bold } from '@expo-google-fonts/lexend/700Bold';
import { useFonts } from '@expo-google-fonts/lexend/useFonts';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useReducer, type ReactNode } from 'react';

import type { BootFailure, MigrationResult } from '@/core/db/configure-and-migrate';
import { err } from '@/shared/domain/result';
import { perfMark } from '@/shared/lib/perf-marks';
import { BootErrorScreen } from '@/shared/ui';

import { bootReducer, isBootSettled } from './boot/boot-machine';
import { useEmergencyExport, type ExportEmergency } from './boot/use-emergency-export';
import { useDependencies } from './dependencies-context';

const LEXEND_FONTS = {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
};

type MigrateDatabase = () => Promise<MigrationResult>;

const migrationRuns = new WeakMap<MigrateDatabase, Promise<MigrationResult>>();

/**
 * Ejecuta la migración una sola vez por tarea: si el gate se vuelve a montar, reutiliza la
 * promesa anterior. Un rechazo o un `throw` síncrono se traducen a `migration_failed`.
 */
function runMigrationOnce(migrateDatabase: MigrateDatabase): Promise<MigrationResult> {
  const existing = migrationRuns.get(migrateDatabase);
  if (existing) {
    return existing;
  }
  const started = Promise.resolve()
    .then(() => {
      if (process.env.EXPO_PUBLIC_E2E === '1') {
        perfMark('boot:migrate:start');
      }
      return migrateDatabase();
    })
    .catch((cause: unknown): MigrationResult => err({ kind: 'migration_failed', cause }))
    .then((result) => {
      if (process.env.EXPO_PUBLIC_E2E === '1') {
        perfMark('boot:migrate:end');
      }
      return result;
    });
  migrationRuns.set(migrateDatabase, started);
  return started;
}

type AfterFirstRender = () => Promise<void>;

const afterFirstRenderRuns = new WeakSet<AfterFirstRender>();

/** Props de {@link MigrationGate}. */
export interface MigrationGateProps {
  readonly migrateDatabase: MigrateDatabase;
  /** Tarea de arranque que corre una sola vez por proceso, después del primer render en `ready`. */
  readonly runAfterFirstRender: AfterFirstRender;
  /** Exportación de emergencia (F8.8) que ofrece la pantalla de error; sin ella no hay acción. */
  readonly exportEmergency?: ExportEmergency;
  readonly children: ReactNode;
}

/** Causa técnica de un fallo de arranque, si la hay, para el logger. */
function causeOf(failure: BootFailure): unknown {
  return failure.kind === 'migration_failed' ? failure.cause : undefined;
}

interface BootFailureViewProps {
  readonly failure: BootFailure;
  readonly exportEmergency: ExportEmergency | undefined;
}

/** Pantalla de error de arranque con la acción de exportación de emergencia conectada. */
function BootFailureView({ failure, exportEmergency }: BootFailureViewProps) {
  const { logger } = useDependencies();
  const emergencyExport = useEmergencyExport(failure.kind, exportEmergency, logger);
  return <BootErrorScreen reason={failure.kind} emergencyExport={emergencyExport} />;
}

/**
 * Puerta de arranque (ADR-005, ADR-006, ADR-014). Mantiene el splash mientras carga las
 * fuentes Lexend y migra la base, dos condiciones independientes que resuelve `bootReducer`.
 * Con todo listo muestra los hijos; si la base falla o es más nueva que el código, muestra
 * la pantalla de error de `shared/ui`, que no ofrece ninguna acción de escritura salvo la
 * exportación de emergencia (copia cruda, nunca escribe en la base), y nunca monta los hijos. Con los hijos montados agenda `runAfterFirstRender` una sola vez por
 * proceso (efecto + `setTimeout(…, 0)`): no bloquea el render y un fallo solo se registra.
 */
export function MigrationGate({
  migrateDatabase,
  runAfterFirstRender,
  exportEmergency,
  children,
}: MigrationGateProps) {
  const { logger } = useDependencies();
  const [state, dispatch] = useReducer(bootReducer, { phase: 'booting' });
  const [fontsLoaded, fontsError] = useFonts(LEXEND_FONTS);

  useEffect(() => {
    dispatch({ type: 'started' });
  }, []);

  useEffect(() => {
    if (fontsError) {
      logger.warn('fonts_failed', { message: fontsError.message });
      dispatch({ type: 'fonts_failed' });
    } else if (fontsLoaded) {
      dispatch({ type: 'fonts_loaded' });
    }
  }, [fontsLoaded, fontsError, logger]);

  useEffect(() => {
    let active = true;
    void runMigrationOnce(migrateDatabase).then((result) => {
      if (!active) {
        return;
      }
      if (result.ok) {
        dispatch({ type: 'database_ready' });
      } else {
        logger.error('boot_failed', causeOf(result.error), { kind: result.error.kind });
        dispatch({ type: 'database_failed', failure: result.error });
      }
    });
    return () => {
      active = false;
    };
  }, [migrateDatabase, logger]);

  const settled = isBootSettled(state);
  useEffect(() => {
    if (settled) {
      SplashScreen.hideAsync().catch((error: unknown) => {
        logger.warn('splash_hide_failed', { message: String(error) });
      });
    }
  }, [settled, logger]);

  const ready = state.phase === 'ready';
  useEffect(() => {
    if (!ready || afterFirstRenderRuns.has(runAfterFirstRender)) {
      return;
    }
    const timer = setTimeout(() => {
      afterFirstRenderRuns.add(runAfterFirstRender);
      Promise.resolve()
        .then(runAfterFirstRender)
        .catch((error: unknown) => {
          logger.error('after_first_render_failed', error);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [ready, runAfterFirstRender, logger]);

  if (state.phase === 'failed') {
    return <BootFailureView failure={state.failure} exportEmergency={exportEmergency} />;
  }
  return state.phase === 'ready' ? children : null;
}

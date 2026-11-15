import { ScrollView, Text } from 'react-native';

import { readPerfMarks } from '@/shared/lib/perf-marks';
import { Screen } from '@/shared/ui';

import { formatPerfReport, type HeapInfo, type StartupTiming } from '../domain/perf-report';

function numberField(source: unknown, key: string): number | null {
  const value: unknown =
    typeof source === 'object' && source !== null ? Reflect.get(source, key) : null;
  return typeof value === 'number' ? value : null;
}

function readStartup(): StartupTiming | null {
  const source: unknown = Reflect.get(performance, 'rnStartupTiming');
  const startTime = numberField(source, 'startTime');
  const initializeRuntimeStart = numberField(source, 'initializeRuntimeStart');
  const executeJavaScriptBundleEntryPointStart = numberField(
    source,
    'executeJavaScriptBundleEntryPointStart',
  );
  const endTime = numberField(source, 'endTime');
  return startTime === null ||
    initializeRuntimeStart === null ||
    executeJavaScriptBundleEntryPointStart === null ||
    endTime === null
    ? null
    : { startTime, initializeRuntimeStart, executeJavaScriptBundleEntryPointStart, endTime };
}

function readHeap(): HeapInfo | null {
  const source: unknown = Reflect.get(performance, 'memory');
  const usedJSHeapSize = numberField(source, 'usedJSHeapSize');
  const totalJSHeapSize = numberField(source, 'totalJSHeapSize');
  return usedJSHeapSize === null || totalJSHeapSize === null
    ? null
    : { usedJSHeapSize, totalJSHeapSize };
}

/**
 * Performance marks of the P1 to P4 budgets, only reachable in the E2E build (ADR-013): the
 * recorded marks plus the native startup timestamps and the Hermes heap, as plain text that a
 * Maestro flow copies with `copyTextFrom` (`tools/perf/parse-marks.js` reads it).
 */
export function PerfMarksScreen() {
  const report = formatPerfReport({
    marks: readPerfMarks(),
    startup: readStartup(),
    heap: readHeap(),
  });
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 px-4 pt-4 pb-8">
        <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
          Marcas de rendimiento
        </Text>
        <Text testID="perf-marks" selectable className="text-sm text-foreground">
          {report}
        </Text>
      </ScrollView>
    </Screen>
  );
}

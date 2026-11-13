import { ScrollView, Text, View } from 'react-native';

import { Card, Screen } from '@/shared/ui';

import { runDateDiagnostics } from '../domain/diagnostic-cases';
import { useDeviceCalendar } from '../hooks/use-device-calendar';

/** Summary of the failed cases, with the singular for exactly one. */
function describeFailures(count: number): string {
  return count === 1 ? '1 caso no coincide' : `${String(count)} casos no coinciden`;
}

/**
 * Date diagnostics of ADR-015, only reachable in the E2E build: runs the fixture cases
 * against the real device calendar and lists what differs.
 */
export function DateDiagnosticsScreen() {
  const report = runDateDiagnostics(useDeviceCalendar());
  const failed = report.rows.filter(({ passed }) => !passed);
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 px-4 pt-4 pb-8">
        <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
          Diagnóstico de fechas
        </Text>
        <Text className="text-base text-muted">{report.zone}</Text>
        <Text className="font-semibold text-lg text-foreground">
          {failed.length === 0 ? 'Todos los casos coinciden' : describeFailures(failed.length)}
        </Text>
        {failed.length === 0 ? null : (
          <Card>
            <View className="gap-3">
              {failed.map(({ kind, description, expected, actual }) => (
                <Text key={`${kind}-${description}`} className="text-sm text-foreground">
                  {`${kind} ${description}: esperado ${expected}, obtenido ${actual}`}
                </Text>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

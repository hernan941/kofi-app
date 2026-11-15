import { Text, View } from 'react-native';

const SAMPLES = [
  { dots: '•', label: 'Poco' },
  { dots: '••', label: 'Medio' },
  { dots: '•••', label: 'Mucho' },
] as const;

const EXPLANATION = 'Un punto es poco y tres puntos es tu mejor día del mes.';

/** Leyenda de los puntos de intensidad (D-41); para el lector es un solo texto con la frase. */
export function CalendarLegend() {
  return (
    <View accessible accessibilityLabel={EXPLANATION} className="gap-1 px-4">
      <View className="flex-row gap-4">
        {SAMPLES.map(({ dots, label }) => (
          <Text key={label} className="text-xs text-muted">
            {dots} {label}
          </Text>
        ))}
      </View>
      <Text className="text-xs text-muted">{EXPLANATION}</Text>
    </View>
  );
}

import { QuestionIcon } from 'phosphor-react-native/src/icons/Question';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from './empty-state';

/** Props of {@link NotFoundScreen}. */
export interface NotFoundScreenProps {
  readonly onGoHome: () => void;
}

/**
 * Screen for an unknown route or invalid route params: says so without blaming the person
 * and offers the main action to go back to the start.
 */
export function NotFoundScreen({ onGoHome }: NotFoundScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <EmptyState
          icon={QuestionIcon}
          title="No encontramos esa pantalla"
          description="Puede que el enlace ya no exista. Vuelve al inicio para seguir."
          primaryAction={{ label: 'Ir al inicio', onPress: onGoHome }}
        />
      </View>
    </SafeAreaView>
  );
}

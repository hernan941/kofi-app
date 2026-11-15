import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

/**
 * `SafeAreaView` from `react-native-safe-area-context` with `className` support. Uniwind
 * only styles React Native core components on its own; without this binding the classes
 * (`flex-1`, `bg-background`) are ignored and the screen collapses to its header on a device.
 */
export const StyledSafeAreaView = withUniwind(SafeAreaView);

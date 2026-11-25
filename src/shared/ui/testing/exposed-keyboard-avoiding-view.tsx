import { View, type KeyboardAvoidingViewProps } from 'react-native';

/**
 * Stand-in for `KeyboardAvoidingView` in tests: a plain `View` that keeps `behavior` as a prop,
 * because the real component does not pass it to the host view and a test could not read it.
 * Use it with `jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', ...)`.
 */
export function ExposedKeyboardAvoidingView(props: KeyboardAvoidingViewProps) {
  return <View {...props} />;
}

export default ExposedKeyboardAvoidingView;

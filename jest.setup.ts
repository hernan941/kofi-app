import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('uniwind', () => ({
  ...jest.requireActual<object>('uniwind'),
  useCSSVariable: require('./src/shared/ui/testing/css-variables').useTestCssVariable,
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationHandler: () => undefined,
  setNotificationChannelAsync: () => Promise.resolve(null),
  getPermissionsAsync: () => Promise.resolve({ status: 'undetermined', granted: false }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'undetermined', granted: false }),
  getAllScheduledNotificationsAsync: () => Promise.resolve([]),
  cancelScheduledNotificationAsync: () => Promise.resolve(),
  scheduleNotificationAsync: () => Promise.resolve('id'),
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
  clearLastNotificationResponse: () => undefined,
}));

/**
 * Common setup for every Jest project. Shared test helpers (`renderWithProviders`) are
 * wired here once they exist (F0.11); mocks are reset automatically by the Jest config.
 *
 * The gesture handler setup and the Worklets mock let HeroUI Native components render in
 * the `ui` project. Uniwind's `useCSSVariable` resolves the light Bruma theme from
 * `src/global.css`, because the compiled stylesheet only exists in Metro. All of them
 * register lazy mocks, so the `node` project never loads React Native through them.
 */
export {};

jest.mock('@expo-google-fonts/lexend/useFonts', () => ({
  useFonts: (): [boolean, null] => [true, null],
}));
jest.mock('@expo-google-fonts/lexend/400Regular', () => ({ Lexend_400Regular: 'regular' }));
jest.mock('@expo-google-fonts/lexend/500Medium', () => ({ Lexend_500Medium: 'medium' }));
jest.mock('@expo-google-fonts/lexend/600SemiBold', () => ({ Lexend_600SemiBold: 'semibold' }));
jest.mock('@expo-google-fonts/lexend/700Bold', () => ({ Lexend_700Bold: 'bold' }));

if (typeof performance.mark !== 'function') {
  Object.assign(performance, {
    mark: (name: string) => ({ name, startTime: performance.now() }),
  });
}

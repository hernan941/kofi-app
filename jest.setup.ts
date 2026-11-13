import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('uniwind', () => ({
  ...jest.requireActual<object>('uniwind'),
  useCSSVariable: require('./src/shared/ui/testing/css-variables').useTestCssVariable,
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

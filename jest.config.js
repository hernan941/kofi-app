const TRANSPILED_PACKAGES = [
  '.pnpm',
  'react-native',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  '@expo-google-fonts',
  'react-navigation',
  '@react-navigation',
  '@sentry/react-native',
  'native-base',
  'standard-navigation',
  'uuid',
  'heroui-native',
  'phosphor-react-native',
  'uniwind',
];

const commonProjectOptions = {
  transformIgnorePatterns: [
    `/node_modules/(?!(${TRANSPILED_PACKAGES.join('|')}))`,
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
};

/**
 * Jest configuration (ADR-013). `uuid` 14, `heroui-native`, `phosphor-react-native` and `uniwind` ship ES
 * modules, so they are added to the packages that Babel transpiles (the rest of the list mirrors
 * the `jest-expo` default). The `ui` project uses the Reanimated 4 Jest resolver. Two projects: `node` runs pure code without loading React
 * Native, and `ui` runs everything that renders or touches Expo modules. The shared
 * Up to half of the CPUs run tests and each test gets 15 s, so UI tests that render whole routes
 * stay stable when the machine is loaded. The shared
 * `globalSetup` pins the time zone for every project (ADR-015). The `node` project maps
 * `react-native` to a stub that throws: `jest-expo/node` is supposed to make the import fail,
 * but its own `react-native` mapper is shadowed by an earlier one and loads the real package.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  globalSetup: '<rootDir>/jest.global-setup.js',
  maxWorkers: '50%',
  testTimeout: 15000,
  projects: [
    {
      ...commonProjectOptions,
      displayName: 'node',
      preset: 'jest-expo/node',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^react-native($|/.*)': '<rootDir>/tools/jest/react-native-forbidden.js',
      },
      testMatch: [
        '<rootDir>/src/**/domain/**/*.test.[jt]s?(x)',
        '<rootDir>/src/**/use-cases/**/*.test.[jt]s?(x)',
        '<rootDir>/src/**/data/**/*.test.[jt]s?(x)',
        '<rootDir>/src/core/db/**/*.test.[jt]s?(x)',
        '<rootDir>/src/core/files/**/*.test.[jt]s?(x)',
        '<rootDir>/src/core/providers/**/*.test.ts',
        '<rootDir>/src/core/e2e/**/*.test.ts',
        '<rootDir>/plugins/**/*.test.js',
        '<rootDir>/tools/eslint/**/*.test.[jt]s?(x)',
        '<rootDir>/tools/licenses/**/*.test.[jt]s?(x)',
        '<rootDir>/tools/perf/**/*.test.[jt]s?(x)',
        '<rootDir>/tools/photos/**/*.test.[jt]s?(x)',
      ],
    },
    {
      ...commonProjectOptions,
      displayName: 'ui',
      preset: 'jest-expo',
      resolver: 'react-native-reanimated/jest/resolver',
      moduleNameMapper: { '\\.css$': '<rootDir>/tools/jest/style-stub.js' },
      testMatch: [
        '<rootDir>/src/**/hooks/**/*.test.[jt]s?(x)',
        '<rootDir>/src/**/components/**/*.test.[jt]s?(x)',
        '<rootDir>/src/**/screens/**/*.test.[jt]s?(x)',
        '<rootDir>/src/**/adapters/**/*.test.[jt]s?(x)',
        '<rootDir>/src/shared/ui/**/*.test.[jt]s?(x)',
        '<rootDir>/src/shared/lib/**/*.test.[jt]s?(x)',
        '<rootDir>/src/core/providers/**/*.test.tsx',
        '<rootDir>/src/core/e2e/**/*.test.tsx',
        '<rootDir>/src/core/dependencies/**/*.test.[jt]s?(x)',
        '<rootDir>/src/core/testing/**/*.test.[jt]s?(x)',
        '<rootDir>/src/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/src/features/*/testing/**/*.test.[jt]s?(x)',
      ],
    },
  ],
};

const REACT_NATIVE_FILE = {
  packageFile: { package: 'react-native', file: 'LICENSE' },
};

/**
 * Part of an exception: a package that has no license file of its own and shares the text of
 * `react-native` (the same repository and copyright holder).
 *
 * @param {string} reason
 * @returns {{ reason: string, parts: object[] }}
 */
function sharesReactNativeText(reason) {
  return { reason, parts: [{ spdxId: 'MIT', part: null, from: REACT_NATIVE_FILE }] };
}

const MONOREPO_REASON =
  'The package has no license file; it lives in the react-native monorepo, whose LICENSE (Meta Platforms, Inc. and affiliates) applies.';

/**
 * Exceptions of the generator (ADR-018). Every entry says why it exists, so the reviewer can
 * check it against the repository of the package.
 *
 * - `notShipped`: direct dependencies that do not travel in the app.
 * - `displayNames`: the name a person knows the package by.
 * - `texts`: license texts that are not a plain `LICENSE` file of the package.
 * - `choices`: the license to use when the package offers one with `OR`.
 *
 * @type {{
 *   notShipped: Record<string, string>,
 *   displayNames: Record<string, string>,
 *   texts: Record<string, { reason: string, parts: { spdxId: string, part: 'code' | 'font' | null, from: object }[] }>,
 *   choices: Record<string, { reason: string, spdxId: string }>,
 * }}
 */
const overrides = {
  notShipped: {
    'react-dom':
      'Peer dependency of expo-router that does not enter the native bundle (ADR-016 removed the web platform).',
    tailwindcss: 'Uniwind uses it only while compiling the styles.',
    'expo-updates':
      'Only used by `eas update` when publishing to Expo Go; it is excluded from autolinking and no source file imports it (ADR-022).',
  },
  displayNames: {
    'heroui-native': 'HeroUI Native',
    '@expo-google-fonts/lexend': 'Lexend',
    'phosphor-react-native': 'Phosphor Icons',
  },
  texts: {
    '@expo-google-fonts/lexend': {
      reason:
        'MIT AND OFL-1.1: LICENSE covers the code (MIT) and LICENSE_FONT the font (SIL Open Font License 1.1).',
      parts: [
        { spdxId: 'MIT', part: 'code', from: { file: 'LICENSE' } },
        { spdxId: 'OFL-1.1', part: 'font', from: { file: 'LICENSE_FONT' } },
      ],
    },
    '@react-native/asset-utils': sharesReactNativeText(MONOREPO_REASON),
    '@react-native/js-polyfills': sharesReactNativeText(MONOREPO_REASON),
    '@react-native/normalize-colors': sharesReactNativeText(MONOREPO_REASON),
    '@react-native/virtualized-lists': sharesReactNativeText(MONOREPO_REASON),
    'expo-router': {
      reason:
        'The package has no license file; it lives in the expo monorepo, whose LICENSE (650 Industries, Inc.) applies.',
      parts: [
        {
          spdxId: 'MIT',
          part: null,
          from: { packageFile: { package: 'expo', file: 'LICENSE' } },
        },
      ],
    },
    'metro-runtime': {
      reason:
        'The installed copy has no license file and its parent package metro has none either. The react/metro repository declares MIT with the copyright of Meta Platforms, Inc. and affiliates, the same holder as react-native.',
      parts: [
        {
          spdxId: 'MIT',
          part: null,
          from: {
            template: 'MIT',
            copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
          },
        },
      ],
    },
    'drizzle-orm': {
      reason:
        'The published package has no license file. The repository carries the standard Apache License 2.0 text with the appendix unfilled and no NOTICE file.',
      parts: [
        { spdxId: 'Apache-2.0', part: null, from: { template: 'Apache-2.0', copyright: null } },
      ],
    },
    'standard-navigation': {
      reason:
        'The published package (0.0.5) has no license file: the LICENSE of the repository was added after that version, and the package.json declares MIT. The text is the MIT template with the copyright of the React Navigation contributors, as in the repository.',
      parts: [
        {
          spdxId: 'MIT',
          part: null,
          from: { template: 'MIT', copyright: 'Copyright (c) 2026 React Navigation Contributors' },
        },
      ],
    },
  },
  choices: {},
};

module.exports = overrides;

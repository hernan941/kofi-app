const FEATURES = [
  'backup',
  'e2e',
  'notifications',
  'products',
  'sales',
  'settings',
  'tips',
  'tracking',
];
const SOURCE_EXTENSIONS = '{ts,tsx}';

const DEPENDENCIES_PATTERNS = ['@/core/dependencies', '@/core/dependencies/**'];
const DEEP_IMPORT_PATTERNS = [
  { group: ['@/features/*/*', '!@/features/*/domain', '!@/features/*/testing'] },
  { group: ['@/features/*/*/**', '!@/features/*/testing/**'] },
];
const DRIZZLE_REPOSITORY_EXCEPTION = '!@/features/*/data/drizzle-*';
const ICON_PACKAGES = ['phosphor-react-native', 'phosphor-react-native/**'];
const PURE_DOMAIN_PACKAGES = [
  'react',
  'react/**',
  'react-native',
  'react-native/**',
  'react-native-*',
  'expo',
  'expo-*',
  'expo-*/**',
  'drizzle-orm',
  'drizzle-orm/**',
  '@/core',
  '@/core/**',
];
const PERSISTENCE_PACKAGES = ['drizzle-orm', 'drizzle-orm/**', 'expo-sqlite', '**/data/drizzle-*'];
const EXPO_PACKAGES = ['expo', 'expo-*', 'expo-*/**'];

/**
 * Builds the `import/no-restricted-paths` zones for a layer: files in `target` cannot
 * import anything that resolves inside `from`.
 *
 * @param {string} target - Glob of the importing files.
 * @param {string[]} from - Globs of the forbidden locations.
 * @returns {{ target: string, from: string[] }} Zone definition; `from` entries are globs
 * because `import/no-restricted-paths` does not accept a mix of globs and plain paths.
 */
function zone(target, from) {
  return { target, from: from.map((path) => (path.endsWith('.ts') ? path : `${path}/**`)) };
}

const feature = (layer) => `./src/features/*/${layer}`;
const UI_LAYERS = [feature('hooks'), feature('components'), feature('screens')];

const INTERNAL_LAYERS = ['data', 'adapters', 'hooks', 'components', 'screens', 'use-cases'];

/**
 * Zones that stop a feature from importing the internal layers of another feature, so the
 * restriction also holds for relative paths (the alias is covered by `no-restricted-imports`).
 * `import/no-restricted-paths` cannot express "any other feature", so one zone per feature.
 */
const CROSS_FEATURE_ZONES = FEATURES.map((name) =>
  zone(
    `./src/features/${name}/**`,
    FEATURES.filter((other) => other !== name).flatMap((other) =>
      INTERNAL_LAYERS.map((layer) => `./src/features/${other}/${layer}`),
    ),
  ),
);

const PATH_ZONES = [
  ...CROSS_FEATURE_ZONES,
  zone('./src/**', [
    './src/core/db/testing',
    './src/core/testing',
    './src/shared/domain/testing',
    './src/shared/lib/testing',
    './src/shared/ui/testing',
    './src/features/*/testing',
  ]),
  zone('./src/shared/domain/**', [
    './src/core',
    './src/features',
    './src/shared/ui',
    './src/shared/lib',
  ]),
  zone('./src/features/*/domain/**', [
    './src/core',
    './src/shared/ui',
    './src/features/*/index.ts',
    feature('data'),
    feature('adapters'),
    feature('use-cases'),
    ...UI_LAYERS,
  ]),
  zone('./src/features/*/data/**', [feature('adapters'), ...UI_LAYERS, './src/app']),
  zone('./src/features/*/adapters/**', [feature('data'), ...UI_LAYERS]),
  zone('./src/features/*/use-cases/**', [feature('adapters'), ...UI_LAYERS, './src/core']),
  zone('./src/features/*/hooks/**', [
    feature('adapters'),
    feature('components'),
    feature('screens'),
    './src/core/db',
    './src/core/files',
    './src/core/dependencies',
  ]),
  zone('./src/features/*/components/**', [feature('data'), feature('adapters'), './src/core']),
  zone('./src/features/*/screens/**', [feature('data'), feature('adapters'), './src/core']),
  zone('./src/shared/ui/**', ['./src/features', './src/core']),
  zone('./src/shared/lib/**', [
    './src/features',
    './src/core/db',
    './src/core/dependencies',
    './src/core/e2e',
    './src/core/files',
    './src/core/testing',
  ]),
  zone('./src/core/providers/**', ['./src/core/dependencies']),
  zone('./src/core/dependencies/**', UI_LAYERS),
  zone('./src/app/**', [
    feature('data'),
    feature('adapters'),
    feature('hooks'),
    feature('components'),
    feature('screens'),
    feature('use-cases'),
    feature('domain'),
  ]),
];

/**
 * Builds the `@typescript-eslint/no-restricted-imports` options for a file category.
 *
 * @param {object} categories - Which restrictions apply.
 * @param {string[]} categories.packages - Import specifiers forbidden in this category.
 * @param {string[]} [categories.typeOnlyAllowed] - Specifiers forbidden unless `import type`.
 * @param {string} [categories.sameFeature] - Feature whose own alias cannot be used.
 * @param {boolean} [categories.allowDependencies] - Whether `core/dependencies` is allowed.
 * @param {boolean} [categories.allowDrizzleRepositories] - Whether `data/drizzle-*` files of any
 * feature can be imported (ADR-005: only the composition root builds repositories).
 * @param {boolean} [categories.allowIcons] - Whether `phosphor-react-native` can be imported
 * (only `shared/ui` wraps icons with `Icon`).
 * @returns {unknown[]} Rule options.
 */
function restrictedImports({
  packages,
  typeOnlyAllowed = [],
  sameFeature,
  allowDependencies,
  allowDrizzleRepositories,
  allowIcons,
}) {
  const deepImports = allowDrizzleRepositories
    ? DEEP_IMPORT_PATTERNS.map(({ group }, index) => ({
        group:
          index === 1 ? [...group, DRIZZLE_REPOSITORY_EXCEPTION] : [...group, '!@/features/*/data'],
      }))
    : DEEP_IMPORT_PATTERNS;
  const patterns = [
    ...deepImports,
    { group: packages },
    ...(allowIcons
      ? []
      : [{ group: ICON_PACKAGES, message: 'Use the Icon component from shared/ui.' }]),
    ...(allowDependencies ? [] : [{ group: DEPENDENCIES_PATTERNS }]),
  ];
  if (typeOnlyAllowed.length > 0) {
    patterns.push({ group: typeOnlyAllowed, allowTypeImports: true });
  }
  if (sameFeature) {
    patterns.push({
      group: [`@/features/${sameFeature}`, `@/features/${sameFeature}/**`],
      message: 'Inside a feature use relative imports.',
    });
  }
  return [{ patterns: patterns.filter((pattern) => pattern.group.length > 0) }];
}

/**
 * Builds one config block with the restricted imports for a set of files.
 *
 * @param {string[]} files - Globs of the files in the category.
 * @param {object} categories - See {@link restrictedImports}.
 * @param {string[]} [ignores] - Globs excluded from the category.
 * @returns {object} Flat config block.
 */
function block(files, categories, ignores = []) {
  return {
    files,
    ignores,
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': ['error', ...restrictedImports(categories)],
    },
  };
}

const featureBlocks = FEATURES.flatMap((name) => {
  const base = `src/features/${name}`;
  const files = (layer) => [`${base}/${layer}/**/*.${SOURCE_EXTENSIONS}`];
  return [
    block(files('domain'), { packages: PURE_DOMAIN_PACKAGES, sameFeature: name }),
    block(files('data'), {
      packages: EXPO_PACKAGES,
      sameFeature: name,
    }),
    block(files('hooks'), {
      packages: PERSISTENCE_PACKAGES,
      typeOnlyAllowed: ['**/data/**', '**/adapters/**'],
      sameFeature: name,
    }),
    block(
      [`${base}/**/*.${SOURCE_EXTENSIONS}`],
      { packages: PERSISTENCE_PACKAGES, sameFeature: name },
      [`${base}/domain/**`, `${base}/data/**`, `${base}/hooks/**`],
    ),
  ];
});

const layerBoundaryConfigs = [
  block([`src/**/*.${SOURCE_EXTENSIONS}`], { packages: PERSISTENCE_PACKAGES }, [
    'src/core/**',
    'src/features/**',
    'src/shared/domain/**',
    'src/app/_layout.tsx',
  ]),
  block([`src/shared/ui/**/*.${SOURCE_EXTENSIONS}`], {
    packages: PERSISTENCE_PACKAGES,
    allowIcons: true,
  }),
  block([`src/shared/domain/**/*.${SOURCE_EXTENSIONS}`], { packages: PURE_DOMAIN_PACKAGES }),
  block([`src/core/**/*.${SOURCE_EXTENSIONS}`], { packages: [] }),
  block([`src/core/dependencies/**/*.${SOURCE_EXTENSIONS}`], {
    packages: [],
    allowDrizzleRepositories: true,
  }),
  block(['src/app/_layout.tsx'], { packages: PERSISTENCE_PACKAGES, allowDependencies: true }),
  ...featureBlocks,
  {
    files: [`src/**/*.${SOURCE_EXTENSIONS}`],
    ignores: ['**/*.test.*', '**/testing/**', 'src/__tests__/**'],
    rules: {
      'import/no-restricted-paths': ['error', { zones: PATH_ZONES }],
    },
  },
];

module.exports = { layerBoundaryConfigs };

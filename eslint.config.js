const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const jsdoc = require('eslint-plugin-jsdoc');
const testingLibrary = require('eslint-plugin-testing-library');
const tseslint = require('typescript-eslint');

const local = require('./tools/eslint');
const { layerBoundaryConfigs } = require('./tools/eslint/layer-boundaries');

const TYPESCRIPT_FILES = ['**/*.{ts,tsx}'];
const TEST_FILES = ['**/*.test.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'];
const LOGGER_FILE = 'src/shared/lib/logger.ts';
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket'];
const GLOBAL_OBJECTS = ['globalThis', 'global', 'window', 'self'];
const GLOBAL_OBJECT_NAMES = GLOBAL_OBJECTS.join('|');
const HERMES_MISSING_METHODS = ['toSorted', 'toReversed', 'toSpliced', 'with'];
const HERMES_MESSAGE =
  'Hermes no implementa este método (ADR-020): usa la versión mutable sobre una copia, por ejemplo [...items].sort(compare).';
const NETWORK_MESSAGE =
  'La app no envía datos a internet (D-23): la nota de privacidad de Ajustes dejaría de ser cierta.';
const NETWORK_SYNTAX = [
  {
    selector: `MemberExpression[computed=true][object.name=/^(${GLOBAL_OBJECT_NAMES})$/], MemberExpression[computed=true][object.expression.name=/^(${GLOBAL_OBJECT_NAMES})$/]`,
    message: `${NETWORK_MESSAGE} No accedas con corchetes a ${GLOBAL_OBJECTS.join(', ')}.`,
  },
  {
    selector: `VariableDeclarator[id.type='ObjectPattern'][init.name=/^(${GLOBAL_OBJECT_NAMES})$/]`,
    message: `${NETWORK_MESSAGE} No desestructures ${GLOBAL_OBJECTS.join(', ')}.`,
  },
  {
    selector: `VariableDeclarator[id.type='Identifier'][init.name=/^(${GLOBAL_OBJECT_NAMES})$/]`,
    message: `${NETWORK_MESSAGE} No guardes ${GLOBAL_OBJECTS.join(', ')} en otra variable.`,
  },
  {
    selector: `AssignmentExpression[left.type='ObjectPattern'][right.name=/^(${GLOBAL_OBJECT_NAMES})$/]`,
    message: `${NETWORK_MESSAGE} No desestructures ${GLOBAL_OBJECTS.join(', ')}.`,
  },
  {
    selector: 'Literal[value=/^https?:[/][/]/], TemplateElement[value.raw=/^https?:[/][/]/]',
    message: `${NETWORK_MESSAGE} No escribas direcciones http(s).`,
  },
  {
    selector: 'Literal[value=/^wss?:[/][/]/], TemplateElement[value.raw=/^wss?:[/][/]/]',
    message: `${NETWORK_MESSAGE} No escribas direcciones ws(s).`,
  },
  {
    selector: 'MemberExpression[property.name=/^(upload|createUploadTask|createDownloadTask)$/]',
    message: `${NETWORK_MESSAGE} No subas ni descargues archivos con expo-file-system.`,
  },
  {
    selector: "Identifier[name='openURL']",
    message: `${NETWORK_MESSAGE} No abras direcciones con openURL.`,
  },
];

/**
 * ESLint configuration (ADR-013). Composes the Expo preset, `typescript-eslint` with type
 * information, the comment policy of ADR-003, the layer boundaries of ADR-005, the
 * Testing Library rules for tests and Prettier last.
 */
module.exports = defineConfig([
  expoConfig,
  {
    files: TYPESCRIPT_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: TYPESCRIPT_FILES,
    extends: [jsdoc.configs['flat/recommended-typescript-error']],
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
            ClassDeclaration: true,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/no-types': 'error',
      'jsdoc/check-tag-names': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    plugins: { local },
    rules: {
      'no-inline-comments': 'error',
      'line-comment-position': ['error', { position: 'above' }],
      'local/docstring-only-comments': 'error',
      'local/routes-only-in-app': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NETWORK_GLOBALS.map((name) => ({ name, message: NETWORK_MESSAGE })),
      ],
      'no-restricted-properties': [
        'error',
        ...GLOBAL_OBJECTS.flatMap((object) =>
          NETWORK_GLOBALS.map((property) => ({ object, property, message: NETWORK_MESSAGE })),
        ),
        { object: 'Linking', property: 'openURL', message: NETWORK_MESSAGE },
        { object: 'File', property: 'downloadFileAsync', message: NETWORK_MESSAGE },
        ...HERMES_MISSING_METHODS.map((property) => ({ property, message: HERMES_MESSAGE })),
      ],
      'no-restricted-syntax': ['error', ...NETWORK_SYNTAX],
      'import/no-extraneous-dependencies': ['error', { devDependencies: false }],
    },
  },
  {
    files: TEST_FILES,
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    files: ['src/**/testing/**/*.{ts,tsx}'],
    rules: { 'import/no-extraneous-dependencies': 'off' },
  },
  {
    files: [LOGGER_FILE],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
  },
  ...layerBoundaryConfigs,
  {
    files: TEST_FILES,
    extends: [testingLibrary.configs['flat/react']],
    languageOptions: { globals: { jest: 'readonly' } },
    rules: { 'jsdoc/require-jsdoc': 'off' },
  },
  {
    files: ['tools/**/*.js', 'plugins/**/*.js', 'jest.*.js', 'eslint.config.js'],
    languageOptions: { globals: { module: 'writable', require: 'readonly', process: 'readonly' } },
  },
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'src/uniwind-types.d.ts',
      'expo-env.d.ts',
      'builds/*',
      'android/*',
      'ios/*',
      'src/core/db/migrations/*',
    ],
  },
]);

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
    files: ['tools/**/*.js', 'jest.*.js', 'eslint.config.js'],
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

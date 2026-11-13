const { RuleTester } = require('eslint');
const tsParser = require('typescript-eslint').parser;

const rule = require('./routes-only-in-app');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('routes-only-in-app', rule, {
  valid: [
    {
      filename: '/repo/src/app/index.tsx',
      code: 'export default function Route() { return <View />; }',
    },
    {
      filename: '/repo/src/app/(tabs)/settings.tsx',
      code: 'const Route = () => <View />;\nexport default Route;',
    },
    {
      filename: '/repo/src/app/_layout.tsx',
      code: 'export default () => <Stack />;',
    },
    {
      filename: '/repo/src/app/+not-found.tsx',
      code: 'export default class NotFound {}',
    },
    {
      filename: '/repo/src/app/+native-intent.tsx',
      code: 'export function redirectSystemPath() { return "/"; }',
    },
    {
      filename: '/repo/src/features/tracking/screens/home-screen.tsx',
      code: 'export function HomeScreen() { return null; }',
    },
    {
      filename: '/repo/src/features/tracking/screens/home-screen.test.tsx',
      code: 'test("x", () => {});',
    },
    {
      filename: '/repo/src/__tests__/navigation.test.tsx',
      code: 'test("x", () => {});',
    },
  ],
  invalid: [
    {
      filename: '/repo/src/app/helpers.ts',
      code: 'export const helper = 1;',
      errors: [{ messageId: 'notARoute' }],
    },
    {
      filename: '/repo/src/app/config.ts',
      code: 'export default { a: 1 };',
      errors: [{ messageId: 'notARoute' }],
    },
    {
      filename: '/repo/src/app/index.test.tsx',
      code: 'export default function Route() { return null; }',
      errors: [{ messageId: 'testInApp' }],
    },
    {
      filename: '/repo/src/app/sales/new.spec.ts',
      code: 'test("x", () => {});',
      errors: [{ messageId: 'testInApp' }],
    },
    {
      filename: '/repo/src/app/+native-intent.tsx',
      code: 'export default function X() { return null; }',
      errors: [{ messageId: 'missingRedirectSystemPath' }],
    },
    {
      filename: 'C:\\repo\\src\\app\\utils.ts',
      code: 'export const a = 1;',
      errors: [{ messageId: 'notARoute' }],
    },
  ],
});

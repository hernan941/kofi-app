const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX = path.join(REPO_ROOT, 'node_modules', '.cache', 'cuantovendi-lint-fixtures');
const PATHS_RULE = 'import/no-restricted-paths';
const IMPORTS_RULE = '@typescript-eslint/no-restricted-imports';
const ROUTES_RULE = 'local/routes-only-in-app';
const COMMENTS_RULE = 'local/docstring-only-comments';
const CONSOLE_RULE = 'no-console';
const GLOBALS_RULE = 'no-restricted-globals';
const PROPERTIES_RULE = 'no-restricted-properties';
const SYNTAX_RULE = 'no-restricted-syntax';
const EXTRANEOUS_RULE = 'import/no-extraneous-dependencies';

const STUBS = {
  'src/features/products/data/product-repository.ts': 'export const productRepository = 1;\n',
  'src/features/products/domain/index.ts': 'export const price = 1;\n',
  'src/features/products/index.ts': 'export const products = 1;\n',
  'src/features/sales/index.ts': 'export const sales = 1;\n',
  'src/features/sales/domain/index.ts': 'export const sale = 1;\n',
  'src/features/products/hooks/use-products.ts': 'export const useProducts = 1;\n',
  'src/features/products/use-cases/save-product.ts': 'export const saveProduct = 1;\n',
  'src/core/db/client.ts': 'export const client = 1;\n',
  'src/core/dependencies/index.ts': 'export const createAppDependencies = 1;\n',
  'src/core/providers/dependencies-context.ts': 'export const useDependencies = 1;\n',
  'src/features/products/data/drizzle-product-repository.ts':
    'export const drizzleProductRepository = 1;\n',
  'src/shared/domain/money.ts': 'export const money = 1;\n',
  'src/shared/domain/testing/fake-clock.ts': 'export const fakeClock = 1;\n',
};

/**
 * Violation fixtures: the file `path` with `code` must report `rule`. Imports written with
 * the `@/` alias and relative ones are covered, as ADR-013 requires.
 */
const VIOLATIONS = [
  {
    name: 'domain importing react-native',
    path: 'src/features/products/domain/price.ts',
    code: "import { View } from 'react-native';\n\nexport const view = View;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'shared domain importing core with the alias',
    path: 'src/shared/domain/money.ts',
    code: "import { client } from '@/core/db/client';\n\nexport const value = client;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'components importing data (relative)',
    path: 'src/features/products/components/card.tsx',
    code: "import { productRepository } from '../data/product-repository';\n\nexport const card = productRepository;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'shared ui importing core with the alias',
    path: 'src/shared/ui/screen.tsx',
    code: "import { client } from '@/core/db/client';\n\nexport const value = client;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'deep import into another feature',
    path: 'src/features/sales/hooks/use-products.ts',
    code: "import { productRepository } from '@/features/products/data/product-repository';\n\nexport const value = productRepository;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'a feature importing another feature data layer by relative path',
    path: 'src/features/sales/hooks/relative-data.ts',
    code: "import { productRepository } from '../../products/data/product-repository';\n\nexport const value = productRepository;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'a feature importing another feature hooks by relative path',
    path: 'src/features/sales/screens/relative-hooks.tsx',
    code: "import { useProducts } from '../../products/hooks/use-products';\n\nexport const value = useProducts;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'a feature importing another feature use cases by relative path',
    path: 'src/features/sales/components/relative-use-cases.tsx',
    code: "import { saveProduct } from '../../products/use-cases/save-product';\n\nexport const value = saveProduct;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'drizzle-orm outside data and core',
    path: 'src/features/products/screens/drizzle-list.tsx',
    code: "import { eq } from 'drizzle-orm';\n\nexport const value = eq;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'expo module inside data',
    path: 'src/features/products/data/files.ts',
    code: "import * as FileSystem from 'expo-file-system';\n\nexport const value = FileSystem;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'core/dependencies outside the root layout',
    path: 'src/features/products/hooks/use-deps.ts',
    code: "import { createAppDependencies } from '@/core/dependencies';\n\nexport const value = createAppDependencies;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'a feature importing itself with the alias',
    path: 'src/features/products/screens/self-import.tsx',
    code: "import { products } from '@/features/products';\n\nexport const value = products;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'a file in src/app that is not a route',
    path: 'src/app/helpers.ts',
    code: 'export const helper = 1;\n',
    rule: ROUTES_RULE,
  },
  {
    name: 'a test inside src/app',
    path: 'src/app/index.test.tsx',
    code: 'export default function Route() {\n  return null;\n}\n',
    rule: ROUTES_RULE,
  },
  {
    name: 'an inline comment inside a function',
    path: 'src/shared/lib/format.ts',
    code: '/** Formats. */\nexport function format() {\n  // not allowed\n  return 1;\n}\n',
    rule: COMMENTS_RULE,
  },
  {
    name: 'phosphor imported outside shared/ui',
    path: 'src/features/products/screens/icon-direct.tsx',
    code: "import { GearIcon } from 'phosphor-react-native/src/icons/Gear';\n\nexport const value = GearIcon;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'phosphor package root imported outside shared/ui',
    path: 'src/shared/lib/icon-direct.ts',
    code: "import { Gear } from 'phosphor-react-native';\n\nexport const value = Gear;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'production code importing a testing folder',
    path: 'src/features/products/screens/uses-fake.tsx',
    code: "import { fakeClock } from '@/shared/domain/testing/fake-clock';\n\nexport const value = fakeClock;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'shared/lib importing core/db',
    path: 'src/shared/lib/uses-db.ts',
    code: "import { client } from '@/core/db/client';\n\nexport const value = client;\n",
    rule: PATHS_RULE,
  },
  {
    name: 'core/dependencies importing a data file that is not a drizzle repository',
    path: 'src/core/dependencies/uses-plain-data.ts',
    code: "import { productRepository } from '@/features/products/data/product-repository';\n\nexport const value = productRepository;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'a drizzle repository imported from a hook',
    path: 'src/features/sales/hooks/uses-drizzle-repo.ts',
    code: "import { drizzleProductRepository } from '@/features/products/data/drizzle-product-repository';\n\nexport const value = drizzleProductRepository;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'a docstring above a statement that is not a declaration',
    path: 'src/shared/lib/statement-docstring.ts',
    code: '/** Calls. */\nexport function call() {\n  /** not a declaration */\n  return 1;\n}\n',
    rule: COMMENTS_RULE,
  },
  {
    name: 'console outside the logger',
    path: 'src/shared/lib/other.ts',
    code: "/** Logs. */\nexport function log() {\n  console.log('x');\n}\n",
    rule: CONSOLE_RULE,
  },
  {
    name: 'fetch in the app',
    path: 'src/features/products/hooks/network-fetch.ts',
    code: "/** Loads. */\nexport function load() {\n  return fetch('https://example.com');\n}\n",
    rule: GLOBALS_RULE,
  },
  {
    name: 'XMLHttpRequest in the app',
    path: 'src/shared/lib/network-xhr.ts',
    code: '/** Opens. */\nexport function open() {\n  return new XMLHttpRequest();\n}\n',
    rule: GLOBALS_RULE,
  },
  {
    name: 'WebSocket in the app',
    path: 'src/shared/lib/network-socket.ts',
    code: "/** Connects. */\nexport function connect() {\n  return new WebSocket('wss://example.com');\n}\n",
    rule: GLOBALS_RULE,
  },
  {
    name: 'globalThis.fetch',
    path: 'src/shared/lib/evade-global-this.ts',
    code: "/** Loads. */\nexport function load() {\n  return globalThis.fetch('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'global.fetch',
    path: 'src/shared/lib/evade-global.ts',
    code: "/** Loads. */\nexport function load() {\n  return global.fetch('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'window.fetch',
    path: 'src/shared/lib/evade-window.ts',
    code: "/** Loads. */\nexport function load() {\n  return window.fetch('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'self.fetch',
    path: 'src/shared/lib/evade-self.ts',
    code: "/** Loads. */\nexport function load() {\n  return self.fetch('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: "globalThis['fetch']",
    path: 'src/shared/lib/evade-computed.ts',
    code: "/** Loads. */\nexport function load() {\n  return globalThis['fetch']('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'a computed property of globalThis',
    path: 'src/shared/lib/evade-computed-variable.ts',
    code: '/** Loads. */\nexport function load(name: string) {\n  return (globalThis as Record<string, unknown>)[name];\n}\n',
    rule: SYNTAX_RULE,
  },
  {
    name: 'destructuring fetch from globalThis',
    path: 'src/shared/lib/evade-destructuring.ts',
    code: "/** Loads. */\nexport function load() {\n  const { fetch: g } = globalThis;\n  return g('x');\n}\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'an alias of globalThis',
    path: 'src/shared/lib/evade-alias.ts',
    code: '/** Loads. */\nexport function load() {\n  const g = globalThis;\n  return g;\n}\n',
    rule: SYNTAX_RULE,
  },
  {
    name: 'new globalThis.WebSocket',
    path: 'src/shared/lib/evade-socket.ts',
    code: "/** Connects. */\nexport function connect() {\n  return new globalThis.WebSocket('x');\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'new globalThis.XMLHttpRequest',
    path: 'src/shared/lib/evade-xhr.ts',
    code: '/** Opens. */\nexport function open() {\n  return new globalThis.XMLHttpRequest();\n}\n',
    rule: PROPERTIES_RULE,
  },
  {
    name: 'an http url literal',
    path: 'src/shared/lib/url-http.ts',
    code: "/** Url. */\nexport const URL_TEXT = 'https://example.com/api';\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'a ws url literal',
    path: 'src/shared/lib/url-ws.ts',
    code: "/** Url. */\nexport const URL_TEXT = 'wss://example.com';\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'Linking.openURL',
    path: 'src/shared/lib/open-url.ts',
    code: "import { Linking } from 'react-native';\n\n/** Opens. */\nexport function open(url: string) {\n  return Linking.openURL(url);\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'an imported openURL',
    path: 'src/shared/lib/open-url-import.ts',
    code: "import { openURL } from 'expo-linking';\n\nexport const open = openURL;\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'a dev dependency imported by the app',
    path: 'src/shared/lib/dev-dependency.ts',
    code: "import { ESLint } from 'eslint';\n\nexport const value = ESLint;\n",
    rule: EXTRANEOUS_RULE,
  },
  {
    name: 'expo/fetch imported',
    path: 'src/shared/lib/net-expo-fetch.ts',
    code: "import { fetch } from 'expo/fetch';\n\nexport const value = fetch;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'expo-network imported',
    path: 'src/shared/lib/net-expo-network.ts',
    code: "import * as Network from 'expo-network';\n\nexport const value = Network;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'expo-web-browser imported',
    path: 'src/shared/lib/net-web-browser.ts',
    code: "import * as WebBrowser from 'expo-web-browser';\n\nexport const value = WebBrowser;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'expo-file-system/legacy imported',
    path: 'src/shared/lib/net-fs-legacy.ts',
    code: "import * as Legacy from 'expo-file-system/legacy';\n\nexport const value = Legacy;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'UploadTask imported from expo-file-system',
    path: 'src/shared/lib/net-upload-task.ts',
    code: "import { UploadTask } from 'expo-file-system';\n\nexport const value = UploadTask;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'DownloadTask imported from expo-file-system',
    path: 'src/shared/lib/net-download-task.ts',
    code: "import { DownloadTask } from 'expo-file-system';\n\nexport const value = DownloadTask;\n",
    rule: IMPORTS_RULE,
  },
  {
    name: 'File.downloadFileAsync',
    path: 'src/shared/lib/net-download-file.ts',
    code: "import { File, Paths } from 'expo-file-system';\n\n/** Downloads. */\nexport function load() {\n  return File.downloadFileAsync('x', Paths.cache);\n}\n",
    rule: PROPERTIES_RULE,
  },
  {
    name: 'file.upload',
    path: 'src/shared/lib/net-file-upload.ts',
    code: "import type { File } from 'expo-file-system';\n\n/** Uploads. */\nexport function send(file: File) {\n  return file.upload('x');\n}\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'file.createUploadTask',
    path: 'src/shared/lib/net-file-upload-task.ts',
    code: "import type { File } from 'expo-file-system';\n\n/** Uploads. */\nexport function send(file: File) {\n  return file.createUploadTask('x');\n}\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'file.createDownloadTask',
    path: 'src/shared/lib/net-file-download-task.ts',
    code: "import type { File } from 'expo-file-system';\n\n/** Downloads. */\nexport function load(file: File) {\n  return file.createDownloadTask('x');\n}\n",
    rule: SYNTAX_RULE,
  },
  {
    name: 'expo-network imported from a feature adapter',
    path: 'src/features/products/adapters/net-expo-network.ts',
    code: "import * as Network from 'expo-network';\n\nexport const value = Network;\n",
    rule: IMPORTS_RULE,
  },
];

const ALLOWED = [
  {
    name: 'Linking.openSettings',
    path: 'src/shared/lib/open-settings.ts',
    code: "import { Linking } from 'react-native';\n\n/** Opens. */\nexport function open() {\n  return Linking.openSettings();\n}\n",
    rules: [PROPERTIES_RULE, SYNTAX_RULE],
  },
  {
    name: 'a computed access to an ordinary object and a plain string',
    path: 'src/shared/lib/ordinary-access.ts',
    code: '/** Reads. */\nexport function read(table: Record<string, number>, key: string) {\n  return `${table[key]} http`;\n}\n',
    rules: [PROPERTIES_RULE, SYNTAX_RULE],
  },
  {
    name: 'network use in a test',
    path: 'src/shared/lib/network.test.ts',
    code: "export const value = globalThis.fetch('https://example.com');\n",
    rules: [PROPERTIES_RULE, SYNTAX_RULE, GLOBALS_RULE],
  },
  {
    name: 'a production dependency imported by the app',
    path: 'src/shared/lib/prod-dependency.ts',
    code: "import { z } from 'zod';\n\nexport const value = z;\n",
    rules: [EXTRANEOUS_RULE],
  },
  {
    name: 'a dev dependency imported by a testing helper',
    path: 'src/shared/lib/testing/helper.ts',
    code: "import { ESLint } from 'eslint';\n\nexport const value = ESLint;\n",
    rules: [EXTRANEOUS_RULE],
  },
  {
    name: 'a dev dependency imported by a test',
    path: 'src/shared/lib/dev-dependency.test.ts',
    code: "import { ESLint } from 'eslint';\n\nexport const value = ESLint;\n",
    rules: [EXTRANEOUS_RULE],
  },
  {
    name: 'a feature importing another feature domain by relative path',
    path: 'src/features/sales/hooks/relative-domain.ts',
    code: "import { price } from '../../products/domain';\n\nexport const value = price;\n",
    rules: [PATHS_RULE],
  },
  {
    name: 'a screen using another feature public api and domain',
    path: 'src/features/products/screens/allowed.tsx',
    code: "import { sales } from '@/features/sales';\nimport { sale } from '@/features/sales/domain';\n\nexport const value = [sales, sale];\n",
    rules: [PATHS_RULE, IMPORTS_RULE],
  },
  {
    name: 'the root layout importing core/dependencies',
    path: 'src/app/_layout.tsx',
    code: "import { createAppDependencies } from '@/core/dependencies';\n\nexport default function Layout() {\n  return createAppDependencies;\n}\n",
    rules: [PATHS_RULE, IMPORTS_RULE, ROUTES_RULE],
  },
  {
    name: 'a method that is called fetch on an object',
    path: 'src/shared/lib/network-method.ts',
    code: '/** Reads. */\nexport function read(store: { fetch(): number }) {\n  return store.fetch();\n}\n',
    rules: [GLOBALS_RULE],
  },
  {
    name: 'the logger using console',
    path: 'src/shared/lib/logger.ts',
    code: "/** Logs. */\nexport function log() {\n  console.log('x');\n}\n",
    rules: [CONSOLE_RULE],
  },
  {
    name: 'phosphor imported inside shared/ui',
    path: 'src/shared/ui/icon-allowed.tsx',
    code: "import { GearIcon } from 'phosphor-react-native/src/icons/Gear';\n\nexport const value = GearIcon;\n",
    rules: [IMPORTS_RULE, PATHS_RULE],
  },
  {
    name: 'a test importing a testing folder',
    path: 'src/features/products/screens/uses-fake.test.tsx',
    code: "import { fakeClock } from '@/shared/domain/testing/fake-clock';\n\nexport const value = fakeClock;\n",
    rules: [PATHS_RULE, IMPORTS_RULE],
  },
  {
    name: 'shared/lib importing core/providers and shared',
    path: 'src/shared/lib/uses-providers.ts',
    code: "import { useDependencies } from '@/core/providers/dependencies-context';\nimport { money } from '@/shared/domain/money';\n\nexport const value = [useDependencies, money];\n",
    rules: [PATHS_RULE, IMPORTS_RULE],
  },
  {
    name: 'core/dependencies importing a drizzle repository',
    path: 'src/core/dependencies/uses-drizzle-repo.ts',
    code: "import { drizzleProductRepository } from '@/features/products/data/drizzle-product-repository';\n\nexport const value = drizzleProductRepository;\n",
    rules: [PATHS_RULE, IMPORTS_RULE],
  },
  {
    name: 'a docstring above a declaration, a member and an export',
    path: 'src/shared/lib/declaration-docstrings.ts',
    code: '/** Shape. */\nexport interface Shape {\n  /** Size. */\n  readonly size: number;\n  /** Grows. */\n  grow(): void;\n}\n\n/** Holder. */\nexport class Holder {\n  /** Value. */\n  value = 1;\n\n  /** Reads. */\n  read(): number {\n    /** Local. */\n    const local = this.value;\n    return local;\n  }\n}\n',
    rules: [COMMENTS_RULE],
  },
  {
    name: 'data using drizzle-orm',
    path: 'src/features/products/data/queries.ts',
    code: "import { eq } from 'drizzle-orm';\n\nexport const value = eq;\n",
    rules: [IMPORTS_RULE],
  },
];

/**
 * Writes the sandbox project: a `tsconfig.json` with the `@/` alias, an ESLint config that
 * reuses the repository one, the stubs and every fixture.
 */
function writeSandbox() {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  const files = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        strict: true,
        jsx: 'react-jsx',
        module: 'esnext',
        moduleResolution: 'bundler',
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src/**/*'],
    }),
    'eslint.config.js': `const base = require(${JSON.stringify(path.join(REPO_ROOT, 'eslint.config.js'))});\nmodule.exports = [...base, { languageOptions: { parserOptions: { tsconfigRootDir: __dirname } } }];\n`,
    ...STUBS,
    ...Object.fromEntries([...VIOLATIONS, ...ALLOWED].map((item) => [item.path, item.code])),
  };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(SANDBOX, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

/**
 * Lints the fixtures that share a path with `ALLOWED` and `VIOLATIONS` entries in a single
 * ESLint run and indexes the reported rule ids by relative file path.
 *
 * @returns {Map<string, string[]>} Rule ids reported per file.
 */
function lintSandbox() {
  const result = spawnSync(
    path.join(REPO_ROOT, 'node_modules', '.bin', 'eslint'),
    ['--format', 'json', '--no-warn-ignored', 'src'],
    { cwd: SANDBOX, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const report = JSON.parse(result.stdout);
  return new Map(
    report.map((file) => [
      path.relative(SANDBOX, file.filePath),
      file.messages.map((message) => message.ruleId),
    ]),
  );
}

describe('layer boundaries and local rules', () => {
  let reported;

  beforeAll(() => {
    writeSandbox();
    reported = lintSandbox();
  });

  test.each(VIOLATIONS)('reports $name', ({ path: file, rule }) => {
    expect(reported.get(file)).toContain(rule);
  });

  test.each(ALLOWED)('accepts $name', ({ path: file, rules }) => {
    const ruleIds = reported.get(file) ?? [];
    for (const rule of rules) {
      expect(ruleIds).not.toContain(rule);
    }
  });
});

#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { packagesFromAutolinking, packagesFromSourceMap } = require('./collect');
const { loadGeneratedModule } = require('./load-generated');
const defaultOverrides = require('./license-overrides');
const { ALLOWED_LICENSES } = require('./policy');
const { buildNotices, lockFingerprint, renderModule } = require('./render');
const { readPackageLicense } = require('./resolve');

const PLATFORMS = ['android', 'ios'];
const MIN_BUNDLED_PACKAGES = 10;
const EXPORT_TIMEOUT_MS = 300_000;
const COMMAND_TIMEOUT_MS = 60_000;
const MODULE_PATH = 'src/features/settings/domain/third-party-notices.generated.ts';
const FROM_PATH = 'tools/licenses/generated-from.json';
const REGENERATE_HINT = 'Ejecuta `npm run licenses:generate`.';

/**
 * Environment of the `expo export` runs: the bundle must be the release one, so the end-to-end
 * flag is removed and the build is for production.
 *
 * @param {NodeJS.ProcessEnv} base
 * @returns {NodeJS.ProcessEnv}
 */
function exportEnvironment(base) {
  const environment = { ...base, NODE_ENV: 'production', CI: '1' };
  delete environment.EXPO_PUBLIC_E2E;
  return environment;
}

/**
 * Runs a command and fails with its output when it does not finish with code 0.
 *
 * @param {string} root
 * @param {string[]} args - Arguments of `npx`.
 * @param {{ env?: NodeJS.ProcessEnv, timeout: number }} options
 * @returns {string} Standard output.
 */
function runNpx(root, args, { env = process.env, timeout }) {
  const result = spawnSync('npx', args, {
    cwd: root,
    env,
    timeout,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
  });
  if (result.status !== 0) {
    throw new Error(
      `npx ${args.join(' ')} failed (${String(result.status ?? result.signal)}):\n${result.stderr}`,
    );
  }
  return result.stdout;
}

/**
 * Sources of the source map of the release bundle of a platform, from a real `expo export`
 * in a temporary directory that is removed at the end.
 *
 * @param {string} root
 * @param {string} platform
 * @returns {string[]}
 */
function exportSources(root, platform) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), `cuantovendi-licenses-${platform}-`));
  try {
    runNpx(
      root,
      ['expo', 'export', '--platform', platform, '--source-maps', '--output-dir', output],
      { env: exportEnvironment(process.env), timeout: EXPORT_TIMEOUT_MS },
    );
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'metadata.json'), 'utf8'));
    const bundle = metadata.fileMetadata?.[platform]?.bundle;
    if (typeof bundle !== 'string') {
      throw new Error(`metadata.json has no bundle for ${platform}.`);
    }
    const mapFile = path.join(output, `${bundle}.map`);
    if (!fs.existsSync(mapFile)) {
      throw new Error(`The source map ${bundle}.map of ${platform} does not exist.`);
    }
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    if (!Array.isArray(map.sources)) {
      throw new Error(`The source map of ${platform} has no "sources" list.`);
    }
    return map.sources;
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
}

/**
 * JSON of `expo-modules-autolinking` and `react-native-config` for a platform.
 *
 * @param {string} root
 * @param {string} platform
 * @returns {{ expo: object, reactNative: object }}
 */
function readAutolinking(root, platform) {
  const options = { timeout: COMMAND_TIMEOUT_MS };
  return {
    expo: JSON.parse(
      runNpx(
        root,
        ['expo-modules-autolinking', 'resolve', '--platform', platform, '--json'],
        options,
      ),
    ),
    reactNative: JSON.parse(
      runNpx(
        root,
        ['expo-modules-autolinking', 'react-native-config', '--platform', platform, '--json'],
        options,
      ),
    ),
  };
}

/**
 * The steps of the generator over the real project.
 *
 * @param {string} root
 */
function createProjectIo(root) {
  const absolute = (relative) => path.join(root, relative);
  const readText = (relative) => {
    try {
      return fs.readFileSync(absolute(relative), 'utf8');
    } catch {
      return null;
    }
  };
  return {
    root,
    overrides: defaultOverrides,
    allowed: ALLOWED_LICENSES,
    exportSources: (platform) => exportSources(root, platform),
    autolinking: (platform) => readAutolinking(root, platform),
    reader: {
      readFile: readText,
      listDir: (relative) => {
        try {
          return fs.readdirSync(absolute(relative));
        } catch {
          return [];
        }
      },
    },
    readLock: () => JSON.parse(fs.readFileSync(absolute('package-lock.json'), 'utf8')),
    readExisting: readText,
    expoVersion: () =>
      JSON.parse(fs.readFileSync(absolute('node_modules/expo/package.json'), 'utf8')).version,
    format: async (source, relative) => {
      const prettier = require('prettier');
      const filepath = absolute(relative);
      const options = (await prettier.resolveConfig(filepath)) ?? {};
      return prettier.format(source, { ...options, filepath });
    },
    writeFile: (relative, content) => {
      fs.writeFileSync(absolute(relative), content);
    },
  };
}

/**
 * Directories of the packages the app distributes: the union, over both platforms, of the
 * bundle and the autolinked native modules.
 *
 * @param {ReturnType<typeof createProjectIo>} io
 * @returns {string[]}
 */
function distributedDirectories(io) {
  const directories = new Set();
  for (const platform of PLATFORMS) {
    const bundled = packagesFromSourceMap(io.exportSources(platform));
    if (bundled.length < MIN_BUNDLED_PACKAGES) {
      throw new Error(
        `The bundle of ${platform} has only ${String(bundled.length)} packages (at least ${String(MIN_BUNDLED_PACKAGES)} are expected): the export format may have changed.`,
      );
    }
    for (const directory of [
      ...bundled,
      ...packagesFromAutolinking(io.autolinking(platform), io.root),
    ]) {
      directories.add(directory);
    }
  }
  return [...directories].sort();
}

/**
 * Describes how the module on disk differs from the freshly built one.
 *
 * @param {string | null} existingSource
 * @param {{ notices: { id: string }[], texts: Record<string, string> }} built
 * @returns {string[]}
 */
function describeDifferences(existingSource, built) {
  if (existingSource === null) {
    return [`No existe ${MODULE_PATH}.`];
  }
  const existing = loadGeneratedModule(existingSource);
  const previous = new Map(existing.THIRD_PARTY_NOTICES.map((notice) => [notice.id, notice]));
  const messages = [];
  for (const notice of built.notices) {
    const old = previous.get(notice.id);
    if (old === undefined) {
      messages.push(`Falta en la lista: ${notice.id}`);
    } else if (!sameNotice(old, notice, existing.LICENSE_TEXTS, built.texts)) {
      messages.push(`Cambió su licencia o su texto: ${notice.id}`);
    }
    previous.delete(notice.id);
  }
  for (const id of previous.keys()) {
    messages.push(`Sobra en la lista: ${id}`);
  }
  return messages;
}

/**
 * Whether two notices say the same, with their texts resolved.
 *
 * @param {{ texts: { textKey: string }[] }} left
 * @param {{ texts: { textKey: string }[] }} right
 * @param {Record<string, string>} leftTexts
 * @param {Record<string, string>} rightTexts
 * @returns {boolean}
 */
function sameNotice(left, right, leftTexts, rightTexts) {
  const resolve = (notice, texts) =>
    JSON.stringify({
      ...notice,
      texts: notice.texts.map(({ textKey, ...rest }) => ({ ...rest, text: texts[textKey] })),
    });
  return resolve(left, leftTexts) === resolve(right, rightTexts);
}

/**
 * Fails when an exception of `texts`, `displayNames` or `choices` is for a package that is no
 * longer distributed, so the file of exceptions does not keep dead entries.
 *
 * @param {{ texts: object, displayNames: object, choices: object }} overrides
 * @param {{ name: string }[]} packages
 */
function assertNoObsoleteOverrides(overrides, packages) {
  const names = new Set(packages.map(({ name }) => name));
  for (const key of ['texts', 'displayNames', 'choices']) {
    for (const name of Object.keys(overrides[key])) {
      if (!names.has(name)) {
        throw new Error(
          `${name}: the exception in "${key}" is obsolete because the package is not distributed; remove it.`,
        );
      }
    }
  }
}

/**
 * Generates (or with `check` only verifies) the module of third-party notices (ADR-018).
 *
 * @param {{ check: boolean, io: ReturnType<typeof createProjectIo> }} options
 * @returns {Promise<{ exitCode: 0 | 1, messages: string[] }>}
 */
async function generate({ check, io }) {
  const directories = distributedDirectories(io);
  const packages = directories.map((directory) =>
    readPackageLicense(directory, {
      reader: io.reader,
      overrides: io.overrides,
      allowed: io.allowed,
    }),
  );
  for (const { name } of packages) {
    if (io.overrides.notShipped[name] !== undefined) {
      throw new Error(`${name}: it is marked as not shipped but it is in the bundle.`);
    }
  }
  assertNoObsoleteOverrides(io.overrides, packages);
  const built = buildNotices(packages);
  const moduleSource = await io.format(renderModule(built), MODULE_PATH);
  const from = await io.format(
    JSON.stringify({
      lockFingerprint: lockFingerprint(io.readLock()),
      platforms: PLATFORMS,
      expoVersion: io.expoVersion(),
    }),
    FROM_PATH,
  );
  if (!check) {
    io.writeFile(MODULE_PATH, moduleSource);
    io.writeFile(FROM_PATH, from);
    return {
      exitCode: 0,
      messages: [`Se escribieron ${String(built.notices.length)} avisos de licencia.`],
    };
  }
  const existingModule = io.readExisting(MODULE_PATH);
  const sameModule = existingModule === moduleSource;
  const sameFrom = io.readExisting(FROM_PATH) === from;
  if (sameModule && sameFrom) {
    return {
      exitCode: 0,
      messages: [`Las licencias están al día (${String(built.notices.length)} paquetes).`],
    };
  }
  const messages = describeDifferences(existingModule, built);
  if (messages.length === 0) {
    messages.push(
      sameModule
        ? `${FROM_PATH} no coincide con las dependencias actuales.`
        : `${MODULE_PATH} no coincide con lo que se genera (¿editado a mano?).`,
    );
  }
  return { exitCode: 1, messages: [...messages, REGENERATE_HINT] };
}

/** Entry point of the command line: `node generate-licenses.js [--check]`. */
async function main() {
  const check = process.argv.includes('--check');
  const root = path.resolve(__dirname, '..', '..');
  const { exitCode, messages } = await generate({ check, io: createProjectIo(root) });
  for (const message of messages) {
    (exitCode === 0 ? process.stdout : process.stderr).write(`${message}\n`);
  }
  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { FROM_PATH, MIN_BUNDLED_PACKAGES, MODULE_PATH, exportEnvironment, generate };

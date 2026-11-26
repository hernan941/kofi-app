const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const LAST_PUBLISHED_PATH = path.join(ROOT, 'builds', 'ios-go', 'last-published.json');
const JOURNAL_PATH = path.join(ROOT, 'src', 'core', 'db', 'migrations', 'meta', '_journal.json');
const BRANCH = 'ios-go';

/**
 * Exact version of `eas-cli` that publishes (ADR-022). It is not a dependency, so it is changed
 * on purpose and never floats with `latest`.
 */
const EAS_CLI_VERSION = '27.11.0';

/**
 * Opciones de una publicación a Expo Go en iOS (ADR-022).
 *
 * @typedef {object} PublishOptions
 * @property {boolean} withMigration - El usuario confirmó que exportó un respaldo antes de publicar una migración nueva.
 */

/**
 * Registro local de la última publicación, en `builds/ios-go/last-published.json`.
 *
 * @typedef {object} LastPublished
 * @property {string} commit - SHA completo publicado.
 * @property {string} group - Id del grupo de updates de EAS.
 * @property {number} journalEntries - Cantidad de migraciones del journal publicado.
 * @property {string} publishedAt - Fecha ISO 8601 en UTC.
 */

/**
 * Decide si se puede publicar a partir de datos ya leídos de git y del registro local; no lee nada.
 *
 * @param {{ porcelain: string, isAncestor: boolean | null, journalEntries: number, last: LastPublished | null, options: PublishOptions }} input - Estado leído.
 * @returns {{ ok: true } | { ok: false, reason: 'dirty-tree' | 'not-descendant' | 'migration-removed' | 'migration-needs-confirmation' }} Resultado.
 */
function checkPublishable({ porcelain, isAncestor, journalEntries, last, options }) {
  if (porcelain.trim() !== '') {
    return { ok: false, reason: 'dirty-tree' };
  }
  if (last === null) {
    return { ok: true };
  }
  if (isAncestor === false) {
    return { ok: false, reason: 'not-descendant' };
  }
  if (journalEntries < last.journalEntries) {
    return { ok: false, reason: 'migration-removed' };
  }
  if (journalEntries > last.journalEntries && !options.withMigration) {
    return { ok: false, reason: 'migration-needs-confirmation' };
  }
  return { ok: true };
}

/**
 * Argumentos exactos de `eas update` para el branch `ios-go`.
 *
 * @param {{ shortSha: string, subject: string }} commit - Commit publicado.
 * @returns {string[]} Argumentos, sin el ejecutable (`npx`).
 */
function buildEasUpdateArgs({ shortSha, subject }) {
  return [
    '--yes',
    `eas-cli@${EAS_CLI_VERSION}`,
    'update',
    '--platform',
    'ios',
    '--branch',
    BRANCH,
    '--environment',
    'production',
    '--message',
    `${shortSha} ${subject}`,
    '--non-interactive',
    '--json',
  ];
}

/**
 * Copia del entorno del proceso sin `EXPO_PUBLIC_E2E`.
 *
 * @param {NodeJS.ProcessEnv} env - Entorno actual.
 * @returns {NodeJS.ProcessEnv} Entorno para `eas update`.
 */
function buildChildEnv(env) {
  const { EXPO_PUBLIC_E2E: _removed, ...rest } = env;
  return rest;
}

/**
 * Runtime version that Expo Go asks for with the installed SDK.
 *
 * @param {string} expoSdkVersion - Versión de `expo` instalada, por ejemplo `58.0.25`.
 * @returns {string} For example `exposdk:58.0.0`.
 */
function expectedRuntimeVersion(expoSdkVersion) {
  return `exposdk:${expoSdkVersion.split('.')[0]}.0.0`;
}

/**
 * Aborts before uploading when the iOS runtime version resolved from the config is not the
 * one Expo Go asks for.
 *
 * @param {string | null | undefined} resolved - Runtime version resolved for iOS.
 * @param {string} expoSdkVersion - Versión de `expo` instalada.
 * @returns {void}
 */
function checkRuntimeVersion(resolved, expoSdkVersion) {
  const expected = expectedRuntimeVersion(expoSdkVersion);
  if (resolved !== expected) {
    throw new Error(
      `El runtimeVersion de iOS resuelto es ${resolved ?? 'ninguno'} y debía ser ${expected}; no se publicó nada.`,
    );
  }
}

/**
 * Finds the update group in the `--json` output of `eas update`, to record a publication
 * even when another validation fails.
 *
 * @param {unknown} output - JSON leído.
 * @returns {string | null} Group id, or `null` when the output has none.
 */
function extractPublishedGroup(output) {
  if (!Array.isArray(output)) {
    return null;
  }
  const withGroup = output.find(
    (update) => typeof update?.group === 'string' && update.group !== '',
  );
  return withGroup ? withGroup.group : null;
}

/**
 * Valida la salida `--json` de `eas update`.
 *
 * @param {unknown} output - JSON leído.
 * @param {string} expoSdkVersion - Versión de `expo` instalada, por ejemplo `58.0.0`.
 * @returns {{ group: string, runtimeVersion: string }} Datos de la update de iOS.
 */
function parsePublishOutput(output, expoSdkVersion) {
  if (!Array.isArray(output) || output.length !== 1) {
    throw new Error('eas update debía publicar exactamente una update.');
  }
  const [update] = output;
  if (update?.platform !== 'ios') {
    throw new Error(`La update publicada debía ser de ios y es de ${update?.platform}.`);
  }
  const expected = expectedRuntimeVersion(expoSdkVersion);
  if (update.runtimeVersion !== expected) {
    throw new Error(
      `El runtimeVersion publicado es ${update.runtimeVersion} y debía ser ${expected}.`,
    );
  }
  if (typeof update.group !== 'string' || update.group === '') {
    throw new Error('La update publicada no trae el id de su grupo.');
  }
  return { group: update.group, runtimeVersion: update.runtimeVersion };
}

/**
 * Link fijo de Expo Go y URL del QR.
 *
 * @param {string} projectId - `extra.eas.projectId`.
 * @param {string} branchId - Id del branch `ios-go`.
 * @returns {{ expoGoUrl: string, qrUrl: string }} Links.
 */
function buildExpoGoLinks(projectId, branchId) {
  return {
    expoGoUrl: `exp://u.expo.dev/${projectId}/branch/${branchId}`,
    qrUrl: `https://qr.expo.dev/eas-update?projectId=${projectId}&branchId=${branchId}`,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_SHA = /^[0-9a-f]{40}$/i;

/**
 * Reads the branch id from the `--json` output of `eas branch:view`; `eas-cli` prints `N/A`
 * when the branch has no updates.
 *
 * @param {unknown} output - JSON leído.
 * @returns {string} Branch id (UUID).
 */
function parseBranchId(output) {
  const id = output?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    throw new Error(`No se pudo leer el id del branch ${BRANCH} (recibido: ${String(id)}).`);
  }
  return id;
}

/**
 * Validates the shape of `builds/ios-go/last-published.json`.
 *
 * @param {unknown} record - JSON leído.
 * @returns {LastPublished} The same record, validated.
 */
function parseLastPublished(record) {
  const valid =
    record !== null &&
    typeof record === 'object' &&
    typeof record.commit === 'string' &&
    FULL_SHA.test(record.commit) &&
    typeof record.group === 'string' &&
    Number.isInteger(record.journalEntries) &&
    record.journalEntries >= 0 &&
    typeof record.publishedAt === 'string';
  if (!valid) {
    throw new Error(
      'builds/ios-go/last-published.json no tiene el formato esperado (last-published inválido); revísalo o bórralo.',
    );
  }
  return record;
}

/**
 * Parses the JSON that a command printed, with context when it is not JSON.
 *
 * @param {string} text - Standard output of the command.
 * @param {string} label - Name of the command, for the message.
 * @returns {unknown} Parsed JSON.
 */
function parseJsonOutput(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `La salida de ${label} no es JSON (${error instanceof Error ? error.message : String(error)}). Empieza con: ${text.slice(0, 200)}`,
    );
  }
}

/**
 * Message for a command that failed, with the exit status, the spawn error and the signal.
 *
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {{ status: number | null, signal: string | null, error?: Error }} result - Result of `spawnSync`.
 * @returns {string} Message.
 */
function describeCommandFailure(command, args, { status, signal, error }) {
  const details = [
    `código ${status ?? 'ninguno'}`,
    signal ? `señal ${signal}` : null,
    error ? `error: ${error.message}` : null,
  ].filter(Boolean);
  return `Falló: ${command} ${args.join(' ')} (${details.join(', ')})`;
}

/**
 * Runs a command without throwing when it fails.
 *
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {{ env?: NodeJS.ProcessEnv, inherit?: boolean }} [options] - Environment and output mode.
 * @returns {{ status: number | null, signal: string | null, error?: Error, stdout: string }} Result.
 */
function runRaw(command, args, { env = process.env, inherit = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'inherit'],
    maxBuffer: 20 * 1024 * 1024,
  });
  return { ...result, stdout: result.stdout ?? '' };
}

/**
 * Runs a command and returns its output; it throws when the command fails.
 *
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {{ env?: NodeJS.ProcessEnv, inherit?: boolean }} [options] - Environment and output mode.
 * @returns {string} Standard output (empty when the output is inherited).
 */
function run(command, args, options) {
  const result = runRaw(command, args, options);
  if (result.status !== 0) {
    throw new Error(describeCommandFailure(command, args, result));
  }
  return result.stdout;
}

/**
 * Lee y parsea un archivo JSON.
 *
 * @param {string} file - Ruta del archivo.
 * @returns {any} Contenido parseado.
 */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Lee el registro de la última publicación y valida su formato.
 *
 * @returns {LastPublished | null} Registro, o `null` la primera vez.
 */
function readLastPublished() {
  if (!fs.existsSync(LAST_PUBLISHED_PATH)) {
    return null;
  }
  return parseLastPublished(readJson(LAST_PUBLISHED_PATH));
}

/**
 * Comprueba si un commit es ancestro de `HEAD`.
 *
 * @param {string} ancestor - SHA del commit publicado antes.
 * @returns {boolean} Si es ancestro de `HEAD`.
 */
function isAncestorOfHead(ancestor) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, 'HEAD'], {
    cwd: ROOT,
  });
  return result.status === 0;
}

const FAILURE_MESSAGES = {
  'dirty-tree': 'El árbol de git tiene cambios sin commitear: lo publicado debe ser un commit.',
  'not-descendant':
    'El commit actual no desciende del último publicado: no se publica código más viejo (ADR-022).',
  'migration-removed':
    'El journal tiene menos migraciones que el último publicado: no se publica hacia atrás (ADR-022).',
  'migration-needs-confirmation':
    'Hay migraciones nuevas. Exporta primero un respaldo en el iPhone y vuelve a correr con --with-migration.',
};

/**
 * Converts the `git log` of `HEAD` into the pieces of the update message.
 *
 * @returns {{ sha: string, shortSha: string, subject: string }} Commit data.
 */
function readHeadCommit() {
  const [sha, shortSha, ...subject] = run('git', ['log', '-1', '--format=%H%n%h%n%s'])
    .trim()
    .split('\n');
  return { sha, shortSha, subject: subject.join(' ') };
}

/**
 * Resolves the iOS runtime version the same way `eas update` will.
 *
 * @returns {Promise<string | null>} Resolved runtime version.
 */
async function resolveIosRuntimeVersion() {
  const { getConfig } = require('@expo/config');
  const { Updates } = require('@expo/config-plugins');
  const { exp } = getConfig(ROOT);
  return Updates.getRuntimeVersionNullableAsync(ROOT, exp, 'ios');
}

/**
 * Aborts when the tree is dirty or `HEAD` moved since the commit that was read at the start.
 *
 * @param {string} sha - SHA read at the start.
 * @returns {void}
 */
function assertUnchanged(sha) {
  if (run('git', ['status', '--porcelain']).trim() !== '') {
    throw new Error(FAILURE_MESSAGES['dirty-tree']);
  }
  if (readHeadCommit().sha !== sha) {
    throw new Error('HEAD cambió durante la publicación; no se publicó nada.');
  }
}

/**
 * Writes the record of the last publication.
 *
 * @param {LastPublished} record - Registro.
 * @returns {void}
 */
function writeLastPublished(record) {
  fs.mkdirSync(path.dirname(LAST_PUBLISHED_PATH), { recursive: true });
  fs.writeFileSync(LAST_PUBLISHED_PATH, `${JSON.stringify(record, null, 2)}\n`);
}

/**
 * Runs `eas update` and records the publication as soon as it has a group, even when a later
 * validation fails.
 *
 * @param {{ sha: string, shortSha: string, subject: string }} commit - Commit publicado.
 * @param {string} expoVersion - Versión de `expo` instalada.
 * @param {number} journalEntries - Migraciones del journal publicado.
 * @returns {string} Group id.
 */
function publish(commit, expoVersion, journalEntries) {
  const args = buildEasUpdateArgs(commit);
  const result = runRaw('npx', args, { env: buildChildEnv(process.env) });
  if (result.status !== 0) {
    throw new Error(describeCommandFailure('npx', args, result));
  }
  const output = parseJsonOutput(result.stdout, 'eas update');
  const group = extractPublishedGroup(output);
  if (group !== null) {
    writeLastPublished({
      commit: commit.sha,
      group,
      journalEntries,
      publishedAt: new Date().toISOString(),
    });
  }
  try {
    return parsePublishOutput(output, expoVersion).group;
  } catch (error) {
    const published = group === null ? '' : `ATENCIÓN: se publicó el grupo ${group}. `;
    throw new Error(`${published}${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Entry point: `node publish-ios-go.js [--with-migration]`.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const options = { withMigration: process.argv.includes('--with-migration') };
  const commit = readHeadCommit();
  const last = readLastPublished();
  const journalEntries = readJson(JOURNAL_PATH).entries.length;
  const check = checkPublishable({
    porcelain: run('git', ['status', '--porcelain']),
    isAncestor: last === null ? null : isAncestorOfHead(last.commit),
    journalEntries,
    last,
    options,
  });
  if (!check.ok) {
    throw new Error(FAILURE_MESSAGES[check.reason]);
  }

  for (const script of ['typecheck', 'lint', 'format:check', 'test']) {
    run('npm', ['run', script], { inherit: true });
  }

  const expoVersion = readJson(path.join(ROOT, 'node_modules', 'expo', 'package.json')).version;
  checkRuntimeVersion(await resolveIosRuntimeVersion(), expoVersion);
  assertUnchanged(commit.sha);

  const group = publish(commit, expoVersion, journalEntries);
  if (run('git', ['status', '--porcelain']).trim() !== '') {
    process.stderr.write(
      `ATENCIÓN: eas-cli modificó archivos del repositorio durante la publicación. Revisa git status.\n`,
    );
  }

  const branchOutput = run(
    'npx',
    ['--yes', `eas-cli@${EAS_CLI_VERSION}`, 'branch:view', BRANCH, '--json', '--non-interactive'],
    { env: buildChildEnv(process.env) },
  );
  const branchId = parseBranchId(parseJsonOutput(branchOutput, 'eas branch:view'));
  const projectId = readJson(path.join(ROOT, 'app.json')).expo.extra.eas.projectId;
  const { expoGoUrl, qrUrl } = buildExpoGoLinks(projectId, branchId);
  process.stdout.write(`Publicado el grupo ${group}.\nLink: ${expoGoUrl}\nQR: ${qrUrl}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EAS_CLI_VERSION,
  buildChildEnv,
  buildEasUpdateArgs,
  buildExpoGoLinks,
  checkPublishable,
  checkRuntimeVersion,
  describeCommandFailure,
  extractPublishedGroup,
  parseBranchId,
  parseJsonOutput,
  parseLastPublished,
  parsePublishOutput,
};

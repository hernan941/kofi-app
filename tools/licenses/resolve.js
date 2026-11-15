const fs = require('node:fs');
const path = require('node:path');

const LICENSE_FILE = /^(licen[cs]e|copying)(?![a-z0-9])/i;
const TEMPLATES_DIRECTORY = path.join(__dirname, 'texts');
const COPYRIGHT_PLACEHOLDER = '{{copyright}}';
const APACHE_COPYRIGHT_LINE = /^( *)Copyright \[yyyy\] \[name of copyright owner\]$/m;

/**
 * @typedef {{ readFile(path: string): string | null, listDir(path: string): string[] }} ProjectReader
 * @typedef {{ spdxId: string, part: 'code' | 'font' | null, text: string }} ResolvedText
 */

const SPDX_ID = /^[A-Za-z0-9.+-]+$/;
const SPDX_KEYWORDS = new Set(['AND', 'OR', 'WITH']);

/**
 * Parses an SPDX expression (`A`, `A AND B`, `A OR B`, `A WITH E`, with parentheses) into a
 * tree. Operators are only the upper case `AND`, `OR` and `WITH`; every token must be consumed.
 * `A WITH E` becomes the single id `A WITH E`, so the policy rejects it unless it is allowed.
 *
 * @param {string} expression
 * @returns {{ type: 'id', id: string } | { type: 'and' | 'or', items: object[] }}
 * @throws {Error} When the expression is malformed (without the package name).
 */
function parseExpression(expression) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let position = 0;

  function fail(detail) {
    throw new Error(`the license expression "${expression}" is malformed (${detail})`);
  }

  function parseId() {
    const token = tokens[position];
    if (token === undefined || !SPDX_ID.test(token) || SPDX_KEYWORDS.has(token)) {
      return fail(`expected a license id, found ${token === undefined ? 'the end' : `"${token}"`}`);
    }
    position += 1;
    return token;
  }

  function parseAtom() {
    if (tokens[position] === '(') {
      position += 1;
      const inner = parseGroup('OR');
      if (tokens[position] !== ')') {
        return fail('a parenthesis is not closed');
      }
      position += 1;
      return inner;
    }
    let id = parseId();
    if (tokens[position] === 'WITH') {
      position += 1;
      id = `${id} WITH ${parseId()}`;
    }
    return { type: 'id', id };
  }

  function parseGroup(operator) {
    const parse = operator === 'OR' ? () => parseGroup('AND') : parseAtom;
    const items = [parse()];
    while (tokens[position] === operator) {
      position += 1;
      items.push(parse());
    }
    return items.length === 1 ? items[0] : { type: operator.toLowerCase(), items };
  }

  const tree = parseGroup('OR');
  if (position < tokens.length) {
    return fail(`unexpected "${tokens[position]}"`);
  }
  return tree;
}

/**
 * Parses the license of a package, naming it when the expression is malformed.
 *
 * @param {string} name
 * @param {string} license
 * @returns {ReturnType<typeof parseExpression>}
 */
function parseLicense(name, license) {
  try {
    return parseExpression(license);
  } catch (error) {
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}.`, {
      cause: error,
    });
  }
}

/**
 * Expands a tree into the licenses that apply: every part of an `AND`, one option of an `OR`.
 *
 * @param {ReturnType<typeof parseExpression>} node
 * @param {{ allowed: readonly string[], choice: string | undefined }} context
 * @returns {string[]}
 */
function applicableLicenses(node, context) {
  if (node.type === 'id') {
    return [node.id];
  }
  if (node.type === 'and') {
    return node.items.flatMap((item) => applicableLicenses(item, context));
  }
  const options = node.items.map((item) => applicableLicenses(item, context));
  const chosen =
    options.find((option) => option.length === 1 && option[0] === context.choice) ??
    options.find((option) => option.every((id) => context.allowed.includes(id)));
  return chosen ?? options[0];
}

/**
 * The license expression written in a manifest, in any of its historical shapes.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {string | null}
 */
function licenseOf(manifest) {
  const { license, licenses } = manifest;
  if (typeof license === 'string') {
    return license;
  }
  if (typeof license === 'object' && license !== null && typeof license.type === 'string') {
    return license.type;
  }
  if (Array.isArray(licenses) && licenses.length > 0) {
    return licenses.map((entry) => (typeof entry === 'string' ? entry : entry.type)).join(' OR ');
  }
  return null;
}

/**
 * Normalizes the line endings and the spaces at the end of every line of a text.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * Text of a template (`MIT` or `Apache-2.0`) with the copyright of the package.
 *
 * @param {'MIT' | 'Apache-2.0'} template
 * @param {string | null} copyright
 * @param {string} name - Package, for the messages.
 * @returns {string}
 */
function templateText(template, copyright, name) {
  const file = path.join(TEMPLATES_DIRECTORY, `${template}.txt`);
  const body = fs.readFileSync(file, 'utf8');
  if (template === 'MIT') {
    if (copyright === null) {
      throw new Error(`${name}: the MIT template needs its copyright line.`);
    }
    return body.replace(COPYRIGHT_PLACEHOLDER, copyright);
  }
  return copyright === null
    ? body
    : body.replace(APACHE_COPYRIGHT_LINE, (_line, indent) => `${indent}${copyright}`);
}

/**
 * Reads the text that one entry of the `texts` overrides points to.
 *
 * @param {{ file: string } | { packageFile: { package: string, file: string } } | { template: 'MIT' | 'Apache-2.0', copyright: string | null }} from
 * @param {{ dir: string, name: string, reader: ProjectReader }} context
 * @returns {string}
 */
function overrideText(from, { dir, name, reader }) {
  if ('template' in from) {
    return templateText(from.template, from.copyright, name);
  }
  const file =
    'file' in from
      ? `${dir}/${from.file}`
      : `node_modules/${from.packageFile.package}/${from.packageFile.file}`;
  const text = reader.readFile(file);
  if (text === null) {
    throw new Error(`${name}: the license file ${file} of its exception does not exist.`);
  }
  return text;
}

/**
 * The license file of a package that has no exception: the only one, or else the one whose
 * name mentions the chosen license (`LICENSE-APACHE` for `Apache-2.0`), or else the only one
 * named exactly `LICENSE`/`LICENCE`/`COPYING` (any extension).
 *
 * @param {string[]} candidates
 * @param {string} spdxId - License chosen for the package.
 * @param {string} name - Package, for the messages.
 * @returns {string}
 */
function mainLicenseFile(candidates, spdxId, name) {
  if (candidates.length === 1) {
    return candidates[0];
  }
  const family = spdxId.toLowerCase().split('-')[0];
  const named = candidates.filter((file) => file.toLowerCase().includes(family));
  const plain = candidates.filter((file) => /^(licen[cs]e|copying)(\.[a-z]+)?$/i.test(file));
  const chosen = named.length === 1 ? named : plain;
  if (chosen.length !== 1) {
    throw new Error(
      `${name}: it has several license files (${candidates.join(', ')}) and none is clearly the one for ${spdxId}; add an exception.`,
    );
  }
  return chosen[0];
}

/**
 * Reads the license of a package that the app distributes (ADR-018): manifest, license files,
 * exceptions and policy.
 *
 * @param {string} dir - Directory of the package, relative to the project.
 * @param {{
 *   reader: ProjectReader,
 *   overrides: { displayNames: Record<string, string>, texts: Record<string, { reason: string, parts: { spdxId: string, part: 'code' | 'font' | null, from: object }[] }>, choices: Record<string, { spdxId: string }> },
 *   allowed: readonly string[],
 * }} options
 * @returns {{ dir: string, name: string, version: string, license: string, displayName: string, texts: ResolvedText[] }}
 */
function readPackageLicense(dir, { reader, overrides, allowed }) {
  const rawManifest = reader.readFile(`${dir}/package.json`);
  if (rawManifest === null) {
    throw new Error(`${dir}: it has no package.json.`);
  }
  const manifest = JSON.parse(rawManifest);
  const { name, version } = manifest;
  const license = licenseOf(manifest);
  if (license === null) {
    throw new Error(`${name}: its package.json declares no license; the policy needs one.`);
  }
  const choice = overrides.choices[name]?.spdxId;
  const ids = applicableLicenses(parseLicense(name, license), { allowed, choice });
  const forbidden = ids.filter((id) => !allowed.includes(id));
  if (forbidden.length > 0) {
    throw new Error(
      `${name}: the license ${license} is not allowed by the policy (${forbidden.join(', ')}).`,
    );
  }
  const files = reader.listDir(dir).filter((file) => LICENSE_FILE.test(file));
  const exception = overrides.texts[name];
  const displayName = overrides.displayNames[name] ?? name;
  const isCompound = ids.length > 1;
  const base = { dir, name, version, license, displayName };

  if (exception === undefined) {
    if (isCompound) {
      throw new Error(`${name}: the license ${license} needs one text per part; add an exception.`);
    }
    if (files.length === 0) {
      throw new Error(`${name}: it has no license file and no exception.`);
    }
    const text = reader.readFile(`${dir}/${mainLicenseFile(files, ids[0], name)}`) ?? '';
    return { ...base, texts: [{ spdxId: ids[0], part: null, text }] };
  }
  if (!isCompound && files.length > 0) {
    throw new Error(`${name}: its exception is unnecessary because it has a license file.`);
  }
  const missing = ids.filter((id) => !exception.parts.some((part) => part.spdxId === id));
  if (missing.length > 0) {
    throw new Error(`${name}: its exception does not cover ${missing.join(', ')}.`);
  }
  const texts = exception.parts.map((part) => ({
    spdxId: part.spdxId,
    part: part.part,
    text: overrideText(part.from, { dir, name, reader }),
  }));
  return { ...base, texts };
}

module.exports = { normalizeText, readPackageLicense };

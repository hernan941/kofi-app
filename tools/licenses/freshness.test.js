const fs = require('node:fs');
const path = require('node:path');

const { findFreshnessProblems } = require('./freshness');
const overrides = require('./license-overrides');
const { loadGeneratedModule } = require('./load-generated');
const { ALLOWED_LICENSES } = require('./policy');
const { lockFingerprint } = require('./render');

const ROOT = path.resolve(__dirname, '..', '..');
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

const REGENERATE = 'npm run licenses:generate';

const LOCK = {
  packages: { '': {}, 'node_modules/a': { version: '1.0.0', integrity: 'sha512-a' } },
};

function notice(packageName, spdxId = 'MIT', textKey = 'k1') {
  return {
    id: packageName,
    packageName,
    displayName: packageName,
    version: '1.0.0',
    license: spdxId,
    texts: [{ spdxId, part: null, textKey }],
  };
}

function inputs(changes = {}) {
  return {
    packageJson: { dependencies: { a: '1.0.0', 'not-shipped': '1.0.0' } },
    lock: LOCK,
    from: { lockFingerprint: lockFingerprint(LOCK) },
    notices: [notice('a')],
    texts: { k1: 'MIT text' },
    notShipped: { 'not-shipped': 'Used only to build.' },
    allowed: ALLOWED_LICENSES,
    ...changes,
  };
}

describe('findFreshnessProblems on the files of the repository', () => {
  it('finds nothing: the list of licenses is up to date', () => {
    const generated = loadGeneratedModule(
      readText('src/features/settings/domain/third-party-notices.generated.ts'),
    );

    const problems = findFreshnessProblems({
      packageJson: readJson('package.json'),
      lock: readJson('package-lock.json'),
      from: readJson('tools/licenses/generated-from.json'),
      notices: generated.THIRD_PARTY_NOTICES,
      texts: generated.LICENSE_TEXTS,
      notShipped: overrides.notShipped,
      allowed: ALLOWED_LICENSES,
    });

    expect(problems).toEqual([]);
  });
});

describe('findFreshnessProblems', () => {
  it('accepts a consistent state', () => {
    expect(findFreshnessProblems(inputs())).toEqual([]);
  });

  it('asks to regenerate when the production dependencies changed', () => {
    const changed = {
      packages: { ...LOCK.packages, 'node_modules/a': { version: '1.0.1', integrity: 'sha512-a' } },
    };

    const problems = findFreshnessProblems(inputs({ lock: changed }));

    expect(problems.join('\n')).toContain(
      `Las dependencias de producción cambiaron: ejecuta \`${REGENERATE}\``,
    );
  });

  it('ignores a development dependency that changed', () => {
    const withDev = {
      packages: { ...LOCK.packages, 'node_modules/dev': { version: '1.0.0', dev: true } },
    };

    expect(findFreshnessProblems(inputs({ lock: withDev }))).toEqual([]);
  });

  it('fails when a direct production dependency has no notice', () => {
    const problems = findFreshnessProblems(
      inputs({ packageJson: { dependencies: { a: '1', 'not-shipped': '1', invented: '1' } } }),
    );

    expect(problems.join('\n')).toMatch(/invented.*no tiene su licencia/);
  });

  it('fails when a package declared as not shipped is no longer a dependency', () => {
    const problems = findFreshnessProblems(inputs({ packageJson: { dependencies: { a: '1' } } }));

    expect(problems.join('\n')).toMatch(/not-shipped.*obsoleta/);
  });

  it('fails when a package declared as not shipped has a notice', () => {
    const problems = findFreshnessProblems(
      inputs({ notices: [notice('a'), notice('not-shipped')] }),
    );

    expect(problems.join('\n')).toMatch(/not-shipped.*aviso/);
  });

  it('fails with a license outside the allowed list', () => {
    const problems = findFreshnessProblems(inputs({ notices: [notice('a', 'GPL-3.0')] }));

    expect(problems.join('\n')).toMatch(/a.*GPL-3\.0/);
  });

  it('fails when a text is empty or missing', () => {
    expect(findFreshnessProblems(inputs({ texts: { k1: '  ' } })).join('\n')).toMatch(/a.*vacío/);
    expect(findFreshnessProblems(inputs({ texts: {} })).join('\n')).toMatch(/a.*k1/);
  });
});

const ts = require('typescript');

const { buildNotices, lockFingerprint, renderModule } = require('./render');

function pkg(name, version, text = 'MIT text', extra = {}) {
  return {
    dir: `node_modules/${name}`,
    name,
    version,
    license: 'MIT',
    displayName: name,
    texts: [{ spdxId: 'MIT', part: null, text }],
    ...extra,
  };
}

describe('buildNotices', () => {
  it('gives the same result whatever the order of the input', () => {
    const packages = [
      pkg('b', '1.0.0'),
      pkg('a', '2.0.0'),
      pkg('a', '1.0.0'),
      pkg('@s/c', '3.0.0'),
    ];

    const forward = buildNotices(packages);
    const backward = buildNotices([...packages].reverse());

    expect(backward).toEqual(forward);
    expect(forward.notices.map((notice) => `${notice.packageName}@${notice.version}`)).toEqual([
      '@s/c@3.0.0',
      'a@1.0.0',
      'a@2.0.0',
      'b@1.0.0',
    ]);
  });

  it('builds a slug id from the name and the version', () => {
    const { notices } = buildNotices([
      pkg('heroui-native', '1.0.11'),
      pkg('@tanstack/react-query', '5.1.0'),
    ]);

    expect(notices.map((notice) => notice.id)).toEqual([
      'tanstack-react-query-5-1-0',
      'heroui-native-1-0-11',
    ]);
  });

  it('gives two versions of the same package different ids', () => {
    const { notices } = buildNotices([pkg('semver', '7.8.6'), pkg('semver', '6.3.1')]);

    expect(new Set(notices.map((notice) => notice.id)).size).toBe(2);
  });

  it('throws when two packages end up with the same id', () => {
    expect(() => buildNotices([pkg('a-b', '1.0.0'), pkg('a/b', '1.0.0')])).toThrow(/a-b-1-0-0/);
  });

  it('keeps a text once when the packages share it after normalizing', () => {
    const { notices, texts } = buildNotices([
      pkg('a', '1.0.0', 'Same text  \r\nsecond line\r\n'),
      pkg('b', '1.0.0', 'Same text\nsecond line'),
      pkg('c', '1.0.0', 'Another text'),
    ]);

    expect(Object.keys(texts)).toHaveLength(2);
    expect(notices[0].texts[0].textKey).toBe(notices[1].texts[0].textKey);
    expect(notices[0].texts[0].textKey).toMatch(/^[0-9a-f]{12}$/);
    expect(texts[notices[0].texts[0].textKey]).toBe('Same text\nsecond line');
  });

  it('keeps the part and the license of each text', () => {
    const { notices } = buildNotices([
      pkg('lexend', '1.0.0', 'x', {
        license: 'MIT AND OFL-1.1',
        texts: [
          { spdxId: 'MIT', part: 'code', text: 'Code' },
          { spdxId: 'OFL-1.1', part: 'font', text: 'Font' },
        ],
      }),
    ]);

    expect(notices[0].license).toBe('MIT AND OFL-1.1');
    expect(notices[0].texts.map(({ spdxId, part }) => [spdxId, part])).toEqual([
      ['MIT', 'code'],
      ['OFL-1.1', 'font'],
    ]);
  });
});

describe('renderModule', () => {
  it('produces TypeScript that compiles and exports the data', () => {
    const built = buildNotices([pkg('a', '1.0.0', 'Text "quoted" \\ back')]);

    const source = renderModule(built);
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exported = {};
    new Function('exports', 'require', result.outputText)(exported, () => ({}));

    expect(result.diagnostics).toHaveLength(0);
    expect(exported.THIRD_PARTY_NOTICES).toEqual(built.notices);
    expect(exported.LICENSE_TEXTS).toEqual(built.texts);
    expect(source).toContain('npm run licenses:generate');
  });
});

describe('lockFingerprint', () => {
  const lock = (entries) => ({ packages: { '': { name: 'app' }, ...entries } });
  const PROD = { 'node_modules/a': { version: '1.0.0', integrity: 'sha512-a' } };

  it('does not change with a new or modified development entry', () => {
    const base = lockFingerprint(lock(PROD));

    expect(
      lockFingerprint(
        lock({ ...PROD, 'node_modules/dev': { version: '1.0.0', integrity: 'x', dev: true } }),
      ),
    ).toBe(base);
    expect(
      lockFingerprint(
        lock({ ...PROD, 'node_modules/dev': { version: '2.0.0', integrity: 'y', dev: true } }),
      ),
    ).toBe(base);
  });

  it('changes with the version or the integrity of a production entry', () => {
    const base = lockFingerprint(lock(PROD));

    expect(
      lockFingerprint(lock({ 'node_modules/a': { version: '1.0.1', integrity: 'sha512-a' } })),
    ).not.toBe(base);
    expect(
      lockFingerprint(lock({ 'node_modules/a': { version: '1.0.0', integrity: 'sha512-b' } })),
    ).not.toBe(base);
  });

  it('does not depend on the order of the entries', () => {
    const second = { 'node_modules/b': { version: '1.0.0', integrity: 'sha512-b' } };

    expect(lockFingerprint(lock({ ...PROD, ...second }))).toBe(
      lockFingerprint(lock({ ...second, ...PROD })),
    );
  });
});

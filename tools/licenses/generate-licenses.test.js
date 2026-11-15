const { exportEnvironment, generate, MODULE_PATH, FROM_PATH } = require('./generate-licenses');

const NO_OVERRIDES = { notShipped: {}, displayNames: {}, texts: {}, choices: {} };

function packageNames(count) {
  return Array.from({ length: count }, (_, index) => `pkg-${String(index).padStart(2, '0')}`);
}

function projectFiles(names, license = 'MIT text') {
  const files = {};
  for (const name of names) {
    files[`node_modules/${name}/package.json`] = JSON.stringify({
      name,
      version: '1.0.0',
      license: 'MIT',
    });
    files[`node_modules/${name}/LICENSE`] = `${license} of ${name}`;
  }
  return files;
}

function sourcesOf(names) {
  return names.map((name) => `/node_modules/${name}/index.js`);
}

/** Fake steps of the generator over an in-memory project. */
function createIo({ android = packageNames(12), ios = android, files, existing = {} } = {}) {
  const project = files ?? projectFiles([...new Set([...android, ...ios])]);
  const written = {};
  const io = {
    root: '/project',
    overrides: NO_OVERRIDES,
    allowed: ['MIT'],
    exportSources: jest.fn((platform) => sourcesOf(platform === 'android' ? android : ios)),
    autolinking: jest.fn(() => ({
      expo: { modules: [] },
      reactNative: { dependencies: {} },
    })),
    reader: {
      readFile: (path) => project[path] ?? null,
      listDir: (path) =>
        Object.keys(project)
          .filter(
            (file) => file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes('/'),
          )
          .map((file) => file.slice(path.length + 1)),
    },
    readLock: () => ({
      packages: { '': {}, 'node_modules/pkg-00': { version: '1.0.0', integrity: 'sha512-x' } },
    }),
    readExisting: (path) => existing[path] ?? null,
    expoVersion: () => '58.0.25',
    format: (source) => Promise.resolve(source),
    writeFile: jest.fn((path, content) => {
      written[path] = content;
    }),
  };
  return { io, written };
}

async function firstGeneration(options) {
  const { io, written } = createIo(options);
  await generate({ check: false, io });
  return { existing: { ...written }, io, written };
}

describe('generate', () => {
  it('writes the module and the record of what it was generated from', async () => {
    const { io, written } = createIo();

    const result = await generate({ check: false, io });

    expect(result.exitCode).toBe(0);
    expect(Object.keys(written).sort()).toEqual([FROM_PATH, MODULE_PATH].sort());
    expect(written[MODULE_PATH]).toContain('pkg-05');
    expect(JSON.parse(written[FROM_PATH])).toEqual({
      lockFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      platforms: ['android', 'ios'],
      expoVersion: '58.0.25',
    });
  });

  it('joins the packages of both platforms', async () => {
    const android = packageNames(12);
    const { io, written } = createIo({ android, ios: [...android, 'ios-only'] });

    await generate({ check: false, io });

    expect(written[MODULE_PATH]).toContain('ios-only');
  });

  it('fails when the bundle of a platform has fewer than 10 packages', async () => {
    const { io } = createIo({ android: packageNames(12), ios: packageNames(9) });

    await expect(generate({ check: false, io })).rejects.toThrow(/ios.*9/);
  });

  it('does not hide a failure to export', async () => {
    const { io } = createIo();
    io.exportSources.mockImplementation(() => {
      throw new Error('The source map does not exist.');
    });

    await expect(generate({ check: false, io })).rejects.toThrow('The source map does not exist.');
  });

  it('fails when a package that is not shipped ends up in the bundle', async () => {
    const { io } = createIo();
    io.overrides = { ...NO_OVERRIDES, notShipped: { 'pkg-01': 'it is only used to build' } };

    await expect(generate({ check: false, io })).rejects.toThrow(/pkg-01/);
  });

  it.each([
    ['texts', { reason: 'r', parts: [] }],
    ['displayNames', 'Gone'],
    ['choices', { reason: 'r', spdxId: 'MIT' }],
  ])(
    'fails when an exception of %s is for a package that is not in the bundle',
    async (key, value) => {
      const { io } = createIo();
      io.overrides = { ...NO_OVERRIDES, [key]: { 'gone-pkg': value } };

      await expect(generate({ check: false, io })).rejects.toThrow(/gone-pkg.*obsolete/i);
    },
  );
});

describe('generate --check', () => {
  it('returns 0 and writes nothing when everything is the same', async () => {
    const { existing } = await firstGeneration();
    const { io } = createIo({ existing });

    const result = await generate({ check: true, io });

    expect(result.exitCode).toBe(0);
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  it('returns 1 when nothing was generated yet', async () => {
    const { io } = createIo();

    const result = await generate({ check: true, io });

    expect(result.exitCode).toBe(1);
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  it('lists a package that is missing from the module', async () => {
    const { existing } = await firstGeneration();
    const { io } = createIo({ android: [...packageNames(12), 'brand-new'], existing });

    const result = await generate({ check: true, io });

    expect(result.exitCode).toBe(1);
    expect(result.messages.join('\n')).toMatch(/brand-new-1-0-0/);
  });

  it('lists a package that is no longer in the bundle', async () => {
    const { existing } = await firstGeneration({ android: [...packageNames(12), 'gone'] });
    const { io } = createIo({ existing });

    const result = await generate({ check: true, io });

    expect(result.exitCode).toBe(1);
    expect(result.messages.join('\n')).toMatch(/gone-1-0-0/);
  });

  it('lists a package whose license text changed', async () => {
    const { existing } = await firstGeneration();
    const names = packageNames(12);
    const { io } = createIo({ files: projectFiles(names, 'Another text'), existing });

    const result = await generate({ check: true, io });

    expect(result.exitCode).toBe(1);
    expect(result.messages.join('\n')).toMatch(/pkg-00-1-0-0/);
  });
});

describe('exportEnvironment', () => {
  it('has no test flag and builds for production', () => {
    const environment = exportEnvironment({ PATH: '/bin', EXPO_PUBLIC_E2E: '1', NODE_ENV: 'test' });

    expect(environment.EXPO_PUBLIC_E2E).toBeUndefined();
    expect(environment.NODE_ENV).toBe('production');
    expect(environment.PATH).toBe('/bin');
  });
});

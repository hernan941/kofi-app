const { readPackageLicense } = require('./resolve');

const MIT_TEXT =
  'MIT License\r\n\r\nCopyright (c) 2020 Someone  \r\n\r\nPermission is hereby granted.\r\n';
const ALLOWED = ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'OFL-1.1'];
const NO_OVERRIDES = { notShipped: {}, displayNames: {}, texts: {}, choices: {} };

/** In-memory project: `files` maps a path to its content. */
function readerOf(files) {
  return {
    readFile: (path) => files[path] ?? null,
    listDir: (path) => {
      const prefix = `${path}/`;
      return Object.keys(files)
        .filter((file) => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
        .map((file) => file.slice(prefix.length));
    },
  };
}

function manifest(fields) {
  return JSON.stringify({ name: 'pkg', version: '1.2.3', ...fields });
}

function resolveWith(files, overrides = {}, dir = 'node_modules/pkg') {
  return readPackageLicense(dir, {
    reader: readerOf(files),
    overrides: { ...NO_OVERRIDES, ...overrides },
    allowed: ALLOWED,
  });
}

describe('readPackageLicense', () => {
  it.each(['LICENSE', 'LICENSE.md', 'LICENCE', 'COPYING', 'license', 'Licence.txt'])(
    'finds the license file %s',
    (fileName) => {
      const result = resolveWith({
        'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
        [`node_modules/pkg/${fileName}`]: MIT_TEXT,
      });

      expect(result.texts).toEqual([{ spdxId: 'MIT', part: null, text: MIT_TEXT }]);
    },
  );

  it('returns the name, version and license of the manifest', () => {
    const result = resolveWith({
      'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
      'node_modules/pkg/LICENSE': MIT_TEXT,
    });

    expect(result).toMatchObject({
      dir: 'node_modules/pkg',
      name: 'pkg',
      version: '1.2.3',
      license: 'MIT',
      displayName: 'pkg',
    });
  });

  it('uses the display name of the overrides', () => {
    const result = resolveWith(
      {
        'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      },
      { displayNames: { pkg: 'Paquete' } },
    );

    expect(result.displayName).toBe('Paquete');
  });

  it('fails naming the package when there is no file and no exception', () => {
    expect(() =>
      resolveWith({ 'node_modules/pkg/package.json': manifest({ license: 'MIT' }) }),
    ).toThrow(/pkg.*license file/i);
  });

  it('takes the text from a file of another package', () => {
    const result = resolveWith(
      {
        'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
        'node_modules/parent/LICENSE': MIT_TEXT,
      },
      {
        texts: {
          pkg: {
            reason: 'same repository',
            parts: [
              {
                spdxId: 'MIT',
                part: null,
                from: { packageFile: { package: 'parent', file: 'LICENSE' } },
              },
            ],
          },
        },
      },
    );

    expect(result.texts).toEqual([{ spdxId: 'MIT', part: null, text: MIT_TEXT }]);
  });

  it('builds the text from the MIT template with its copyright', () => {
    const result = resolveWith(
      { 'node_modules/pkg/package.json': manifest({ license: 'MIT' }) },
      {
        texts: {
          pkg: {
            reason: 'no file',
            parts: [
              {
                spdxId: 'MIT',
                part: null,
                from: { template: 'MIT', copyright: 'Copyright (c) 2026 Someone' },
              },
            ],
          },
        },
      },
    );

    expect(result.texts[0].text).toContain('Copyright (c) 2026 Someone');
    expect(result.texts[0].text).toContain('Permission is hereby granted');
  });

  it('builds the Apache text from the template without a copyright line', () => {
    const result = resolveWith(
      { 'node_modules/pkg/package.json': manifest({ license: 'Apache-2.0' }) },
      {
        texts: {
          pkg: {
            reason: 'no file',
            parts: [
              {
                spdxId: 'Apache-2.0',
                part: null,
                from: { template: 'Apache-2.0', copyright: null },
              },
            ],
          },
        },
      },
    );

    expect(result.texts[0].text).toContain('Apache License');
    expect(result.texts[0].text).toContain('Version 2.0');
  });

  it('asks for one text per part of an AND license', () => {
    expect(() =>
      resolveWith({
        'node_modules/pkg/package.json': manifest({ license: 'MIT AND OFL-1.1' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      }),
    ).toThrow(/pkg.*MIT AND OFL-1\.1/);
  });

  it('returns a text per part of an AND license with its exception', () => {
    const result = resolveWith(
      {
        'node_modules/pkg/package.json': manifest({ license: 'MIT AND OFL-1.1' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
        'node_modules/pkg/LICENSE_FONT': 'Font license text',
      },
      {
        texts: {
          pkg: {
            reason: 'code and font',
            parts: [
              { spdxId: 'MIT', part: 'code', from: { file: 'LICENSE' } },
              { spdxId: 'OFL-1.1', part: 'font', from: { file: 'LICENSE_FONT' } },
            ],
          },
        },
      },
    );

    expect(result.texts).toEqual([
      { spdxId: 'MIT', part: 'code', text: MIT_TEXT },
      { spdxId: 'OFL-1.1', part: 'font', text: 'Font license text' },
    ]);
  });

  it('fails when the exception does not cover every part of the license', () => {
    expect(() =>
      resolveWith(
        {
          'node_modules/pkg/package.json': manifest({ license: 'MIT AND OFL-1.1' }),
          'node_modules/pkg/LICENSE': MIT_TEXT,
        },
        {
          texts: {
            pkg: {
              reason: 'partial',
              parts: [{ spdxId: 'MIT', part: 'code', from: { file: 'LICENSE' } }],
            },
          },
        },
      ),
    ).toThrow(/pkg.*OFL-1\.1/);
  });

  it('takes the first allowed option of an OR license', () => {
    const result = resolveWith({
      'node_modules/pkg/package.json': manifest({ license: 'MIT OR Apache-2.0' }),
      'node_modules/pkg/LICENSE': MIT_TEXT,
    });

    expect(result.texts.map((text) => text.spdxId)).toEqual(['MIT']);
  });

  it('skips the options that the policy does not allow', () => {
    const result = resolveWith({
      'node_modules/pkg/package.json': manifest({ license: '(BSD-3-Clause OR GPL-2.0)' }),
      'node_modules/pkg/LICENSE': MIT_TEXT,
    });

    expect(result.texts.map((text) => text.spdxId)).toEqual(['BSD-3-Clause']);
  });

  it('respects the choice of the overrides for an OR license', () => {
    const result = resolveWith(
      {
        'node_modules/pkg/package.json': manifest({ license: 'MIT OR Apache-2.0' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      },
      { choices: { pkg: { reason: 'we prefer it', spdxId: 'Apache-2.0' } } },
    );

    expect(result.texts.map((text) => text.spdxId)).toEqual(['Apache-2.0']);
  });

  it.each([
    ['MIT and GPL-3.0'],
    ['MIT or GPL-3.0'],
    ['MIT GPL-3.0'],
    ['MIT AND'],
    ['(MIT'],
    ['MIT)'],
  ])('fails naming the package when the expression %s is malformed', (license) => {
    expect(() =>
      resolveWith({
        'node_modules/pkg/package.json': manifest({ license }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      }),
    ).toThrow(/pkg.*(malformed|not allowed)/i);
  });

  it('does not let a lower case operator hide a license the policy rejects', () => {
    expect(() =>
      resolveWith({
        'node_modules/pkg/package.json': manifest({ license: 'MIT and GPL-3.0' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      }),
    ).toThrow(/pkg.*malformed/i);
  });

  it('treats an exception clause as a compound license that the policy rejects', () => {
    expect(() =>
      resolveWith({
        'node_modules/pkg/package.json': manifest({ license: 'MIT WITH Classpath-exception-2.0' }),
        'node_modules/pkg/LICENSE': MIT_TEXT,
      }),
    ).toThrow(/pkg.*not allowed.*MIT WITH Classpath-exception-2\.0/i);
  });

  it('accepts a nested expression with AND, OR and parentheses', () => {
    const result = resolveWith(
      {
        'node_modules/pkg/package.json': manifest({ license: '(MIT OR GPL-3.0) AND ISC' }),
      },
      {
        texts: {
          pkg: {
            reason: 'two parts',
            parts: [
              { spdxId: 'MIT', part: 'code', from: { template: 'MIT', copyright: 'c' } },
              { spdxId: 'ISC', part: 'font', from: { template: 'MIT', copyright: 'c' } },
            ],
          },
        },
      },
    );

    expect(result.texts.map((text) => text.spdxId)).toEqual(['MIT', 'ISC']);
  });

  it('picks the license file that matches the chosen license', () => {
    const files = {
      'node_modules/pkg/package.json': manifest({ license: 'MIT OR Apache-2.0' }),
      'node_modules/pkg/LICENSE-MIT': 'the mit text',
      'node_modules/pkg/LICENSE-APACHE': 'the apache text',
    };

    expect(resolveWith(files).texts[0].text).toBe('the mit text');
    expect(
      resolveWith(files, { choices: { pkg: { reason: 'r', spdxId: 'Apache-2.0' } } }).texts[0].text,
    ).toBe('the apache text');
  });

  it('asks for an exception when several license files could apply', () => {
    expect(() =>
      resolveWith({
        'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
        'node_modules/pkg/LICENSE-ONE': 'one',
        'node_modules/pkg/LICENSE-TWO': 'two',
      }),
    ).toThrow(/pkg.*several license files/i);
  });

  it('falls back to the plain LICENSE file when no file name matches', () => {
    const result = resolveWith({
      'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
      'node_modules/pkg/LICENSE': 'main',
      'node_modules/pkg/LICENSE-THIRD-PARTY': 'other',
    });

    expect(result.texts[0].text).toBe('main');
  });

  it.each([['GPL-3.0'], ['MPL-2.0'], ['UNLICENSED'], [undefined]])(
    'fails the policy for the license %s naming the package',
    (license) => {
      expect(() =>
        resolveWith({
          'node_modules/pkg/package.json': manifest(license === undefined ? {} : { license }),
          'node_modules/pkg/LICENSE': MIT_TEXT,
        }),
      ).toThrow(/pkg/);
    },
  );

  it('fails when an exception exists for a package that already has its file', () => {
    expect(() =>
      resolveWith(
        {
          'node_modules/pkg/package.json': manifest({ license: 'MIT' }),
          'node_modules/pkg/LICENSE': MIT_TEXT,
        },
        {
          texts: {
            pkg: {
              reason: 'not needed',
              parts: [{ spdxId: 'MIT', part: null, from: { file: 'LICENSE' } }],
            },
          },
        },
      ),
    ).toThrow(/pkg.*unnecessary/i);
  });

  it('reads the license of an old manifest with a type object', () => {
    const result = resolveWith({
      'node_modules/pkg/package.json': manifest({ license: { type: 'MIT' } }),
      'node_modules/pkg/LICENSE': MIT_TEXT,
    });

    expect(result.license).toBe('MIT');
  });
});

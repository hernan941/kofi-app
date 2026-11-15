const { packagesFromAutolinking, packagesFromSourceMap } = require('./collect');

describe('packagesFromSourceMap', () => {
  it('turns file paths into package directories', () => {
    expect(
      packagesFromSourceMap([
        '/node_modules/react/index.js',
        '/node_modules/react/cjs/react.production.js',
        '/node_modules/@tanstack/react-query/build/index.js',
      ]),
    ).toEqual(['node_modules/@tanstack/react-query', 'node_modules/react']);
  });

  it('keeps nested packages apart from the one they live in', () => {
    expect(
      packagesFromSourceMap([
        '/node_modules/semver/index.js',
        '/node_modules/react-native-reanimated/node_modules/semver/index.js',
        '/node_modules/metro/node_modules/metro-runtime/src/polyfills/require.js',
      ]),
    ).toEqual([
      'node_modules/metro/node_modules/metro-runtime',
      'node_modules/react-native-reanimated/node_modules/semver',
      'node_modules/semver',
    ]);
  });

  it('ignores the sources of the app and virtual modules', () => {
    expect(
      packagesFromSourceMap([
        '/src/app/(tabs)/_layout.tsx',
        '/src/app?ctx=f5d9e791',
        '\u0000polyfill:external-require',
        '\u0000shim:HMRClientProdShim.js',
        '/App.tsx',
      ]),
    ).toEqual([]);
  });

  it('accepts relative and absolute paths without repeating packages', () => {
    expect(
      packagesFromSourceMap([
        'node_modules/zod/index.js',
        '/home/me/app/node_modules/zod/v4/core.js',
        '/node_modules/zod/package.json',
      ]),
    ).toEqual(['node_modules/zod']);
  });

  it('ignores a query string after the file name', () => {
    expect(packagesFromSourceMap(['/node_modules/uuid/dist/index.js?ctx=abc'])).toEqual([
      'node_modules/uuid',
    ]);
  });
});

describe('packagesFromAutolinking', () => {
  const ROOT = '/home/me/app';

  it('reads the Expo modules and the React Native dependencies', () => {
    const result = packagesFromAutolinking(
      {
        expo: { modules: [{ packageName: 'expo-asset' }, { packageName: '@expo/log-box' }] },
        reactNative: {
          dependencies: {
            '@react-native-masked-view/masked-view': {
              root: `${ROOT}/node_modules/@react-native-masked-view/masked-view`,
            },
          },
        },
      },
      ROOT,
    );

    expect(result).toEqual([
      'node_modules/@expo/log-box',
      'node_modules/@react-native-masked-view/masked-view',
      'node_modules/expo-asset',
    ]);
  });

  it('fails with a clear message when the Expo output has another shape', () => {
    expect(() =>
      packagesFromAutolinking({ expo: {}, reactNative: { dependencies: {} } }, ROOT),
    ).toThrow(/modules/);
  });

  it('fails with a clear message when the React Native output has another shape', () => {
    expect(() => packagesFromAutolinking({ expo: { modules: [] }, reactNative: {} }, ROOT)).toThrow(
      /dependencies/,
    );
  });

  it('ignores dependencies that live outside node_modules', () => {
    const result = packagesFromAutolinking(
      {
        expo: { modules: [] },
        reactNative: { dependencies: { local: { root: `${ROOT}/modules/local` } } },
      },
      ROOT,
    );

    expect(result).toEqual([]);
  });
});

const NODE_MODULES = 'node_modules';

/**
 * Directory of the package a source file belongs to, or `null` when the file is not inside
 * `node_modules`. Nested packages keep their whole chain
 * (`node_modules/metro/node_modules/metro-runtime`).
 *
 * @param {string} source - Path of a source of the bundle, absolute or relative.
 * @returns {string | null} Directory relative to the project, starting with `node_modules/`.
 */
function packageDirectoryOf(source) {
  const path = source.split('?')[0];
  const segments = path.split('/').filter((segment) => segment !== '');
  const first = segments.indexOf(NODE_MODULES);
  if (first === -1) {
    return null;
  }
  const kept = [];
  let index = first;
  while (index < segments.length && segments[index] === NODE_MODULES) {
    const name = segments[index + 1];
    if (name === undefined) {
      return null;
    }
    const length = name.startsWith('@') ? 2 : 1;
    const nameSegments = segments.slice(index + 1, index + 1 + length);
    if (nameSegments.length < length) {
      return null;
    }
    kept.push(NODE_MODULES, ...nameSegments);
    index += 1 + length;
  }
  return kept.join('/');
}

/**
 * Package directories whose files ended up in the bundle (ADR-018).
 *
 * @param {readonly string[]} sources - The `sources` of the source map.
 * @returns {string[]} Sorted directories relative to the project, without repeats.
 */
function packagesFromSourceMap(sources) {
  const directories = new Set();
  for (const source of sources) {
    const directory = packageDirectoryOf(source);
    if (directory !== null) {
      directories.add(directory);
    }
  }
  return [...directories].sort();
}

/**
 * Package directories that contribute native code, from the JSON of
 * `expo-modules-autolinking resolve` and `react-native-config`.
 *
 * @param {{ expo: { modules?: { packageName: string }[] }, reactNative: { dependencies?: Record<string, { root: string }> } }} autolinking
 * @param {string} projectRoot - Absolute root of the project.
 * @returns {string[]} Sorted directories relative to the project, without repeats.
 */
function packagesFromAutolinking({ expo, reactNative }, projectRoot) {
  if (!Array.isArray(expo.modules)) {
    throw new Error('The output of expo-modules-autolinking has no "modules" list.');
  }
  if (typeof reactNative.dependencies !== 'object' || reactNative.dependencies === null) {
    throw new Error('The output of react-native-config has no "dependencies" object.');
  }
  const directories = new Set();
  for (const { packageName } of expo.modules) {
    directories.add(`${NODE_MODULES}/${packageName}`);
  }
  const prefix = `${projectRoot.replace(/\/$/, '')}/`;
  for (const { root } of Object.values(reactNative.dependencies)) {
    const relative = root.startsWith(prefix) ? root.slice(prefix.length) : root;
    const directory = packageDirectoryOf(relative);
    if (directory !== null) {
      directories.add(directory);
    }
  }
  return [...directories].sort();
}

module.exports = { packagesFromAutolinking, packagesFromSourceMap };

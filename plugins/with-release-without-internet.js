const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod } = require('expo/config-plugins');

const RELEASE_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>
</manifest>
`;

/**
 * Writes `app/src/release/AndroidManifest.xml` under the Android project, which removes the
 * INTERNET permission from every release variant (ADR-016, amendment F10.4).
 *
 * @param {string} platformProjectRoot - Absolute path of the `android/` folder.
 */
function writeReleaseManifest(platformProjectRoot) {
  const directory = path.join(platformProjectRoot, 'app', 'src', 'release');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'AndroidManifest.xml'), RELEASE_MANIFEST);
}

/**
 * Expo config plugin: release and `e2e` builds ship without INTERNET (D-23). The debug build
 * keeps it because Metro needs it. The permission comes from the main manifest, so the
 * release variant manifest removes it with `tools:node="remove"` when the manifests merge.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config - Expo config.
 * @returns {import('@expo/config-plugins').ExpoConfig} Config with the mod registered.
 */
function withReleaseWithoutInternet(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      writeReleaseManifest(modConfig.modRequest.platformProjectRoot);
      return modConfig;
    },
  ]);
}

module.exports = withReleaseWithoutInternet;
module.exports.RELEASE_MANIFEST = RELEASE_MANIFEST;
module.exports.writeReleaseManifest = writeReleaseManifest;

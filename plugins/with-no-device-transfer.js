const fs = require('node:fs');
const path = require('node:path');

const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];
const DATA_EXTRACTION_RULES_RESOURCE = 'data_extraction_rules';
const FULL_BACKUP_CONTENT_RESOURCE = 'full_backup_content';

/**
 * Builds the `<exclude>` lines for every domain.
 *
 * @param {string} indent - Indentation of each line.
 * @returns {string} XML lines.
 */
function excludeLines(indent) {
  return DOMAINS.map((domain) => `${indent}<exclude domain="${domain}" path="."/>`).join('\n');
}

/**
 * Builds `res/xml/data_extraction_rules.xml` (Android 12 and later): nothing goes to the
 * cloud backup or to a device-to-device transfer.
 *
 * @returns {string} XML content.
 */
function buildDataExtractionRules() {
  return `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludeLines('    ')}
  </cloud-backup>
  <device-transfer>
${excludeLines('    ')}
  </device-transfer>
</data-extraction-rules>
`;
}

/**
 * Builds `res/xml/full_backup_content.xml` (Android 11 and earlier): nothing is backed up.
 *
 * @returns {string} XML content.
 */
function buildFullBackupContent() {
  return `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${excludeLines('  ')}
</full-backup-content>
`;
}

/**
 * Points the `<application>` element at the two exclusion files.
 *
 * @param {{ manifest: { application?: Array<{ $: Record<string, string> }> } }} manifest - Parsed manifest.
 * @returns {typeof manifest} The same manifest, with the attributes set.
 */
function applyBackupAttributes(manifest) {
  const [application] = manifest.manifest.application ?? [];
  if (!application) {
    throw new Error('AndroidManifest.xml has no <application> element.');
  }
  application.$['android:dataExtractionRules'] = `@xml/${DATA_EXTRACTION_RULES_RESOURCE}`;
  application.$['android:fullBackupContent'] = `@xml/${FULL_BACKUP_CONTENT_RESOURCE}`;
  return manifest;
}

/**
 * Writes both XML files under `app/src/main/res/xml` of the Android project.
 *
 * @param {string} platformProjectRoot - Absolute path of the `android/` folder.
 */
function writeBackupRules(platformProjectRoot) {
  const directory = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `${DATA_EXTRACTION_RULES_RESOURCE}.xml`),
    buildDataExtractionRules(),
  );
  fs.writeFileSync(
    path.join(directory, `${FULL_BACKUP_CONTENT_RESOURCE}.xml`),
    buildFullBackupContent(),
  );
}

/**
 * Expo config plugin: nothing leaves the phone by Google backup or by device transfer, so
 * "si cambias de teléfono, tus datos no se pasan solos" stays true (ADR-016, amendment F10.4).
 * It complements `android:allowBackup="false"` with the exclusion rules that Android 12 and
 * later (`dataExtractionRules`) and Android 11 and earlier (`fullBackupContent`) read.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config - Expo config.
 * @returns {import('@expo/config-plugins').ExpoConfig} Config with the mods registered.
 */
function withNoDeviceTransfer(config) {
  const withManifest = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = applyBackupAttributes(modConfig.modResults);
    return modConfig;
  });
  return withDangerousMod(withManifest, [
    'android',
    (modConfig) => {
      writeBackupRules(modConfig.modRequest.platformProjectRoot);
      return modConfig;
    },
  ]);
}

module.exports = withNoDeviceTransfer;
module.exports.DOMAINS = DOMAINS;
module.exports.buildDataExtractionRules = buildDataExtractionRules;
module.exports.buildFullBackupContent = buildFullBackupContent;
module.exports.applyBackupAttributes = applyBackupAttributes;
module.exports.writeBackupRules = writeBackupRules;

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const withNoDeviceTransfer = require('./with-no-device-transfer');

const {
  DOMAINS,
  buildDataExtractionRules,
  buildFullBackupContent,
  applyBackupAttributes,
  writeBackupRules,
} = withNoDeviceTransfer;

const domainsIn = (xml) => [...xml.matchAll(/domain="(\w+)"/g)].map((match) => match[1]);

describe('backup and device transfer rules', () => {
  it('excludes every domain', () => {
    expect([...DOMAINS].sort()).toEqual(['database', 'external', 'file', 'root', 'sharedpref']);
  });

  it('excludes every domain from cloud backup and from device transfer', () => {
    const xml = buildDataExtractionRules();
    const cloud = xml.slice(xml.indexOf('<cloud-backup'), xml.indexOf('</cloud-backup>'));
    const transfer = xml.slice(xml.indexOf('<device-transfer'), xml.indexOf('</device-transfer>'));

    expect(domainsIn(cloud).sort()).toEqual([...DOMAINS].sort());
    expect(domainsIn(transfer).sort()).toEqual([...DOMAINS].sort());
    expect(xml).not.toContain('<include');
  });

  it('excludes every domain from the Android 11 full backup', () => {
    const xml = buildFullBackupContent();

    expect(xml).toContain('<full-backup-content>');
    expect(domainsIn(xml).sort()).toEqual([...DOMAINS].sort());
    expect(xml).not.toContain('<include');
  });

  it('points the application at both files', () => {
    const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } };

    const result = applyBackupAttributes(manifest);

    const attributes = result.manifest.application[0].$;
    expect(attributes['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
    expect(attributes['android:fullBackupContent']).toBe('@xml/full_backup_content');
    expect(attributes['android:name']).toBe('.MainApplication');
  });

  it('writes both XML files under res/xml', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-backup-rules-'));
    try {
      writeBackupRules(root);

      const xmlDir = path.join(root, 'app', 'src', 'main', 'res', 'xml');
      expect(fs.readFileSync(path.join(xmlDir, 'data_extraction_rules.xml'), 'utf8')).toBe(
        buildDataExtractionRules(),
      );
      expect(fs.readFileSync(path.join(xmlDir, 'full_backup_content.xml'), 'utf8')).toBe(
        buildFullBackupContent(),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers a manifest mod and a dangerous mod for Android', () => {
    const config = withNoDeviceTransfer({ name: 'app', slug: 'app' });

    expect(config.mods?.android?.manifest).toBeDefined();
    expect(config.mods?.android?.dangerous).toBeDefined();
  });
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const withReleaseWithoutInternet = require('./with-release-without-internet');

const { RELEASE_MANIFEST, writeReleaseManifest } = withReleaseWithoutInternet;

describe('release manifest without INTERNET', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-release-manifest-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('removes the INTERNET permission that the main manifest declares', () => {
    expect(RELEASE_MANIFEST).toContain('android.permission.INTERNET');
    expect(RELEASE_MANIFEST).toContain('tools:node="remove"');
    expect(RELEASE_MANIFEST).toContain('xmlns:tools="http://schemas.android.com/tools"');
  });

  it('writes the manifest only for the release variant', () => {
    writeReleaseManifest(root);

    const release = path.join(root, 'app', 'src', 'release', 'AndroidManifest.xml');
    expect(fs.readFileSync(release, 'utf8')).toBe(RELEASE_MANIFEST);
    expect(fs.existsSync(path.join(root, 'app', 'src', 'debug'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app', 'src', 'main'))).toBe(false);
  });

  it('overwrites a previous release manifest', () => {
    writeReleaseManifest(root);
    writeReleaseManifest(root);

    const release = path.join(root, 'app', 'src', 'release', 'AndroidManifest.xml');
    expect(fs.readFileSync(release, 'utf8')).toBe(RELEASE_MANIFEST);
  });

  it('registers a dangerous mod for Android', () => {
    const config = withReleaseWithoutInternet({ name: 'app', slug: 'app' });

    expect(config.mods?.android?.dangerous).toBeDefined();
  });
});

import appJson from '../../app.json';
import packageJson from '../../package.json';

const { expo } = appJson;

describe('app.json privacy settings', () => {
  it('disables Android Auto Backup so the database and photos never reach Google Drive', () => {
    expect((expo.android as { allowBackup?: boolean }).allowBackup).toBe(false);
  });

  it('keeps remote notifications off', () => {
    const plugin = expo.plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-notifications',
    ) as [string, { enableRemoteNotifications: boolean }] | undefined;

    expect(plugin?.[1].enableRemoteNotifications).toBe(false);
  });

  it('blocks the permissions the app does not need', () => {
    expect([...expo.android.blockedPermissions].sort()).toEqual(
      [
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
        'android.permission.ACCESS_NETWORK_STATE',
        'com.google.android.c2dm.permission.RECEIVE',
      ].sort(),
    );
  });
});

describe('app.json local plugins and iOS settings', () => {
  it('registers the plugin that removes INTERNET from release builds', () => {
    expect(expo.plugins).toContain('./plugins/with-release-without-internet');
  });

  it('registers the plugin that blocks cloud backup and device transfer', () => {
    expect(expo.plugins).toContain('./plugins/with-no-device-transfer');
  });

  it('shows the product name Kofi to the user', () => {
    expect(expo.name).toBe('Kofi');
  });

  it('keeps the internal identifiers stable so existing data survives', () => {
    expect(expo.slug).toBe('cuantovendi');
    expect(expo.scheme).toBe('cuantovendi');
  });

  it('has a bundle identifier for iOS', () => {
    expect(expo.ios.bundleIdentifier).toBe('com.cuantovendi.local');
  });

  it('only allows plain HTTP to the local network', () => {
    expect(expo.ios.infoPlist.NSAppTransportSecurity).toEqual({
      NSAllowsArbitraryLoads: false,
      NSAllowsLocalNetworking: true,
    });
  });
});

describe('package.json native build scripts', () => {
  const { scripts } = packageJson as { scripts: Record<string, string> };
  const PREBUILD = 'npx expo prebuild --clean --platform android && ';

  it.each(['android', 'android:release', 'e2e:build'])(
    'regenerates the native project before compiling in "%s" (ADR-016)',
    (name) => {
      const script = scripts[name] ?? '';

      expect(script).toContain(PREBUILD);
      expect(script.indexOf(PREBUILD)).toBeLessThan(script.indexOf('expo run:android'));
    },
  );

  it('still generates the fixtures and sets the E2E flag in the e2e build', () => {
    expect(scripts['e2e:build']).toContain('npm run e2e:fixtures');
    expect(scripts['e2e:build']).toContain('EXPO_PUBLIC_E2E=1 expo run:android --variant release');
  });
});

describe('EAS Update for Expo Go on iOS (ADR-022)', () => {
  const { expo: config } = appJson as unknown as {
    expo: {
      owner?: string;
      runtimeVersion?: unknown;
      updates?: { enabled?: boolean; url?: string };
      ios: { runtimeVersion?: unknown };
      android: { runtimeVersion?: unknown };
      extra: { eas: { projectId: string } };
    };
  };
  const pkg = packageJson as unknown as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
    expo: { autolinking: Record<'android' | 'ios', { exclude: string[] }> };
  };
  const EXCLUDED_MODULES = [
    'expo-updates',
    'expo-manifests',
    'expo-eas-client',
    'expo-structured-headers',
    'expo-updates-interface',
    'expo-json-utils',
  ];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it('keeps updates disabled for native builds', () => {
    expect(config.updates?.enabled).toBe(false);
  });

  it('points the updates url to the EAS project', () => {
    expect(config.extra.eas.projectId).toMatch(UUID);
    expect(config.updates?.url).toBe(`https://u.expo.dev/${config.extra.eas.projectId}`);
  });

  it('defines the runtime version only for iOS, following the SDK', () => {
    expect(config.ios.runtimeVersion).toEqual({ policy: 'sdkVersion' });
    expect(config.runtimeVersion).toBeUndefined();
    expect(config.android.runtimeVersion).toBeUndefined();
  });

  it('has an owner', () => {
    expect(config.owner).toBeTruthy();
  });

  it('installs expo-updates as a dependency', () => {
    expect(pkg.dependencies['expo-updates']).toBeDefined();
  });

  it.each(['android', 'ios'] as const)(
    'excludes expo-updates and its native modules from %s autolinking',
    (platform) => {
      expect(pkg.expo.autolinking[platform].exclude).toEqual(
        expect.arrayContaining(EXCLUDED_MODULES),
      );
    },
  );

  it('publishes to Expo Go with the publish script', () => {
    expect(pkg.scripts['publish:ios-go']).toBe('node tools/publish/publish-ios-go.js');
  });
});

const {
  EAS_CLI_VERSION,
  buildChildEnv,
  buildEasUpdateArgs,
  buildExpoGoLinks,
  checkPublishable,
  checkRuntimeVersion,
  describeCommandFailure,
  extractPublishedGroup,
  parseBranchId,
  parseJsonOutput,
  parseLastPublished,
  parsePublishOutput,
} = require('./publish-ios-go');

const LAST = {
  commit: 'a'.repeat(40),
  group: 'group-1',
  journalEntries: 5,
  publishedAt: '2026-11-26T12:00:00.000Z',
};

const READY = {
  porcelain: '',
  isAncestor: true,
  journalEntries: 5,
  last: LAST,
  options: { withMigration: false },
};

describe('checkPublishable', () => {
  it('passes when the tree is clean and nothing changed', () => {
    expect(checkPublishable(READY)).toEqual({ ok: true });
  });

  it('fails with a dirty tree', () => {
    expect(checkPublishable({ ...READY, porcelain: ' M app.json\n' })).toEqual({
      ok: false,
      reason: 'dirty-tree',
    });
  });

  it('fails when the last published commit is not an ancestor of HEAD', () => {
    expect(checkPublishable({ ...READY, isAncestor: false })).toEqual({
      ok: false,
      reason: 'not-descendant',
    });
  });

  it('fails when the journal changed without confirmation', () => {
    expect(checkPublishable({ ...READY, journalEntries: 6 })).toEqual({
      ok: false,
      reason: 'migration-needs-confirmation',
    });
  });

  it('blocks when migrations were removed, even with confirmation', () => {
    expect(
      checkPublishable({ ...READY, journalEntries: 4, options: { withMigration: true } }),
    ).toEqual({ ok: false, reason: 'migration-removed' });
  });

  it('passes with a new migration when the backup was confirmed', () => {
    expect(
      checkPublishable({ ...READY, journalEntries: 6, options: { withMigration: true } }),
    ).toEqual({ ok: true });
  });

  it('passes on the first publication, without a previous record', () => {
    expect(checkPublishable({ ...READY, last: null, isAncestor: null, journalEntries: 7 })).toEqual(
      { ok: true },
    );
  });
});

describe('buildEasUpdateArgs', () => {
  it('builds the exact arguments for the ios-go branch', () => {
    expect(buildEasUpdateArgs({ shortSha: 'abc1234', subject: 'Fix sale form' })).toEqual([
      '--yes',
      `eas-cli@${EAS_CLI_VERSION}`,
      'update',
      '--platform',
      'ios',
      '--branch',
      'ios-go',
      '--environment',
      'production',
      '--message',
      'abc1234 Fix sale form',
      '--non-interactive',
      '--json',
    ]);
  });
});

describe('EAS_CLI_VERSION', () => {
  it('is an exact semver version', () => {
    expect(EAS_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('buildChildEnv', () => {
  it('removes EXPO_PUBLIC_E2E without mutating the input', () => {
    const env = { PATH: '/bin', EXPO_PUBLIC_E2E: '1' };

    const child = buildChildEnv(env);

    expect(child).toEqual({ PATH: '/bin' });
    expect(env).toEqual({ PATH: '/bin', EXPO_PUBLIC_E2E: '1' });
  });
});

describe('parsePublishOutput', () => {
  const update = { id: 'u1', group: 'g1', platform: 'ios', runtimeVersion: 'exposdk:58.0.0' };

  it('accepts a single iOS update with the SDK runtime version', () => {
    expect(parsePublishOutput([update], '58.0.0')).toEqual({
      group: 'g1',
      runtimeVersion: 'exposdk:58.0.0',
    });
  });

  it('accepts the SDK version of a patch release of expo', () => {
    expect(parsePublishOutput([update], '58.0.25')).toEqual({
      group: 'g1',
      runtimeVersion: 'exposdk:58.0.0',
    });
  });

  it('rejects a different runtime version', () => {
    expect(() => parsePublishOutput([{ ...update, runtimeVersion: '1.0.0' }], '58.0.0')).toThrow(
      /runtimeVersion/,
    );
  });

  it('rejects an Android update', () => {
    expect(() => parsePublishOutput([{ ...update, platform: 'android' }], '58.0.0')).toThrow(/ios/);
  });

  it('rejects more than one update', () => {
    expect(() => parsePublishOutput([update, update], '58.0.0')).toThrow();
  });

  it.each([[[]], [null], [undefined], [{}]])('rejects an empty output (%j)', (output) => {
    expect(() => parsePublishOutput(output, '58.0.0')).toThrow();
  });
});

describe('buildExpoGoLinks', () => {
  it('builds the fixed Expo Go link and the QR url', () => {
    expect(buildExpoGoLinks('project-id', 'branch-id')).toEqual({
      expoGoUrl: 'exp://u.expo.dev/project-id/branch/branch-id',
      qrUrl: 'https://qr.expo.dev/eas-update?projectId=project-id&branchId=branch-id',
    });
  });
});

describe('checkRuntimeVersion', () => {
  it('accepts the SDK runtime version of the installed expo', () => {
    expect(() => checkRuntimeVersion('exposdk:58.0.0', '58.0.25')).not.toThrow();
  });

  it.each([['1.0.0'], [null], [undefined], ['exposdk:57.0.0']])(
    'rejects %j before publishing',
    (resolved) => {
      expect(() => checkRuntimeVersion(resolved, '58.0.25')).toThrow(/runtimeVersion/);
    },
  );
});

describe('parseBranchId', () => {
  const ID = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

  it('returns a UUID id', () => {
    expect(parseBranchId({ name: 'ios-go', id: ID })).toBe(ID);
  });

  it.each([[{ id: 'N/A' }], [{}], [null], [{ id: 5 }]])('rejects %j', (output) => {
    expect(() => parseBranchId(output)).toThrow(/branch/);
  });
});

describe('parseLastPublished', () => {
  const valid = { ...LAST };

  it('accepts a well-formed record', () => {
    expect(parseLastPublished(valid)).toEqual(valid);
  });

  it.each([
    [{ ...valid, commit: 'abc' }],
    [{ ...valid, journalEntries: '5' }],
    [{ ...valid, journalEntries: -1 }],
    [{ ...valid, group: 3 }],
    [null],
  ])('rejects %j', (record) => {
    expect(() => parseLastPublished(record)).toThrow(/last-published/);
  });
});

describe('extractPublishedGroup', () => {
  it('returns the group of the first update that has one', () => {
    expect(extractPublishedGroup([{ platform: 'android' }, { group: 'g9' }])).toBe('g9');
  });

  it.each([[[]], [null], [{}], [[{ group: '' }]]])('returns null for %j', (output) => {
    expect(extractPublishedGroup(output)).toBeNull();
  });
});

describe('parseJsonOutput', () => {
  it('parses valid JSON', () => {
    expect(parseJsonOutput('[1]', 'eas update')).toEqual([1]);
  });

  it('names the command and shows the start of the output when it is not JSON', () => {
    expect(() => parseJsonOutput('Oops, not json', 'eas update')).toThrow(/eas update.*Oops/s);
  });
});

describe('describeCommandFailure', () => {
  it('includes the status, the spawn error and the signal', () => {
    const message = describeCommandFailure('npx', ['a'], {
      status: null,
      signal: 'SIGKILL',
      error: new Error('spawn failed'),
    });

    expect(message).toContain('npx a');
    expect(message).toContain('spawn failed');
    expect(message).toContain('SIGKILL');
  });
});

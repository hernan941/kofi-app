import {
  LICENSE_LABELS,
  findNotice,
  licenseLabel,
  noticeIdSchema,
  noticeTexts,
  sortNotices,
  type NoticeId,
  type ThirdPartyNotice,
} from './third-party-notices';
import { LICENSE_TEXTS, THIRD_PARTY_NOTICES } from './third-party-notices.generated';

function noticeNamed(displayName: string, version = '1.0.0'): ThirdPartyNotice {
  return {
    id: `${displayName}-${version}` as NoticeId,
    packageName: displayName,
    displayName,
    version,
    license: 'MIT',
    texts: [{ spdxId: 'MIT', part: null, textKey: 'k' }],
  };
}

function noticeOf(displayName: string): ThirdPartyNotice {
  const notice = THIRD_PARTY_NOTICES.find((candidate) => candidate.displayName === displayName);
  if (notice === undefined) {
    throw new Error(`There is no notice for ${displayName}.`);
  }
  return notice;
}

const { ALLOWED_LICENSES } = jest.requireActual<{ ALLOWED_LICENSES: readonly string[] }>(
  '../../../../tools/licenses/policy',
);

describe('THIRD_PARTY_NOTICES', () => {
  it('includes HeroUI Native with its Apache 2.0 text', () => {
    const notice = noticeOf('HeroUI Native');

    expect(notice.license).toBe('Apache-2.0');
    const [text] = noticeTexts(notice, LICENSE_TEXTS);
    expect(text?.spdxId).toBe('Apache-2.0');
    expect(text?.text).toContain('Apache License');
    expect(text?.text).toContain('Version 2.0');
  });

  it('includes Lexend with the MIT code license and the OFL font license', () => {
    const texts = noticeTexts(noticeOf('Lexend'), LICENSE_TEXTS);

    expect(texts.map(({ spdxId, part }) => [spdxId, part])).toEqual([
      ['MIT', 'code'],
      ['OFL-1.1', 'font'],
    ]);
    expect(texts[1]?.text).toContain('SIL Open Font License');
  });

  it('includes Phosphor Icons with its MIT text and author', () => {
    const [text] = noticeTexts(noticeOf('Phosphor Icons'), LICENSE_TEXTS);

    expect(text?.spdxId).toBe('MIT');
    expect(text?.text).toContain('Dustin Do');
  });

  it('points every text to an existing one with a readable license name', () => {
    for (const notice of THIRD_PARTY_NOTICES) {
      for (const { spdxId, textKey } of notice.texts) {
        expect(LICENSE_TEXTS[textKey]).toBeDefined();
        expect(LICENSE_LABELS[spdxId]).toBeDefined();
      }
    }
  });

  it('has no repeated ids and every id is a valid route id', () => {
    const ids = THIRD_PARTY_NOTICES.map((notice) => notice.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(noticeIdSchema.safeParse(id).success).toBe(true);
    }
  });
});

describe('LICENSE_LABELS', () => {
  it('has a name for exactly the allowed licenses', () => {
    expect(Object.keys(LICENSE_LABELS).sort()).toEqual([...ALLOWED_LICENSES].sort());
  });

  it('uses the names of the design', () => {
    expect(LICENSE_LABELS).toEqual({
      MIT: 'MIT',
      ISC: 'ISC',
      'Apache-2.0': 'Apache 2.0',
      'BSD-2-Clause': 'BSD de 2 cláusulas',
      'BSD-3-Clause': 'BSD de 3 cláusulas',
      '0BSD': 'BSD de cero cláusulas',
      'BlueOak-1.0.0': 'Blue Oak 1.0.0',
      'OFL-1.1': 'SIL Open Font License 1.1',
      'CC0-1.0': 'CC0 1.0',
      Unlicense: 'Unlicense',
    });
  });
});

describe('sortNotices', () => {
  const names = (notices: readonly ThirdPartyNotice[]) =>
    notices.map((notice) => `${notice.displayName}@${notice.version}`);

  it('ignores case', () => {
    expect(
      names(sortNotices([noticeNamed('beta'), noticeNamed('Alfa'), noticeNamed('Charlie')])),
    ).toEqual(['Alfa@1.0.0', 'beta@1.0.0', 'Charlie@1.0.0']);
  });

  it('ignores the leading @ of a scoped name', () => {
    const sorted = sortNotices([
      noticeNamed('zod'),
      noticeNamed('@tanstack/react-query'),
      noticeNamed('react-native'),
      noticeNamed('@babel/runtime'),
    ]);

    expect(names(sorted)).toEqual([
      '@babel/runtime@1.0.0',
      'react-native@1.0.0',
      '@tanstack/react-query@1.0.0',
      'zod@1.0.0',
    ]);
  });

  it('breaks a tie by version, by number', () => {
    const sorted = sortNotices([noticeNamed('semver', '10.0.0'), noticeNamed('semver', '7.8.6')]);

    expect(names(sorted)).toEqual(['semver@7.8.6', 'semver@10.0.0']);
  });

  it('is stable and does not change its input', () => {
    const input = [noticeNamed('b'), noticeNamed('a')];
    const copy = [...input];

    sortNotices(input);

    expect(input).toEqual(copy);
  });
});

describe('findNotice', () => {
  it('finds a notice by id', () => {
    const notice = noticeOf('HeroUI Native');

    expect(findNotice(THIRD_PARTY_NOTICES, notice.id)).toBe(notice);
  });

  it('gives null for an unknown id', () => {
    expect(findNotice(THIRD_PARTY_NOTICES, 'no-existe' as NoticeId)).toBeNull();
  });
});

describe('noticeIdSchema', () => {
  it.each(['heroui-native-1-0-11', 'a', 'a'.repeat(214)])('accepts %s', (id) => {
    expect(noticeIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(['../x', 'Mayusculas', '', 'a'.repeat(215), 'con espacio', 'a/b'])('rejects %j', (id) => {
    expect(noticeIdSchema.safeParse(id).success).toBe(false);
  });
});

describe('licenseLabel', () => {
  it('returns the readable name of a known license', () => {
    expect(licenseLabel('Apache-2.0')).toBe('Apache 2.0');
  });

  it('falls back to the SPDX id of an unknown license', () => {
    expect(licenseLabel('Zlib')).toBe('Zlib');
  });
});

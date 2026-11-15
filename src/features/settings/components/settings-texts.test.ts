import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import type { NoticeId, ThirdPartyNotice } from '../domain';
import {
  BACKUP_SUMMARY_WITHOUT_COPY,
  LICENSES_TEXTS,
  SETTINGS_TEXTS,
  backupSummaryText,
  licenseDetailHeading,
  licenseNames,
  licenseRowLabel,
  licenseRowSubtitle,
  versionText,
} from './settings-texts';

function notice(
  texts: ThirdPartyNotice['texts'],
  overrides: Partial<ThirdPartyNotice> = {},
): ThirdPartyNotice {
  return {
    id: 'x-1' as NoticeId,
    packageName: 'x',
    displayName: 'X',
    version: '1.0.0',
    license: 'MIT',
    texts,
    ...overrides,
  };
}

const HEROUI = notice([{ spdxId: 'Apache-2.0', part: null, textKey: 'a' }], {
  displayName: 'HeroUI Native',
  version: '1.0.11',
  license: 'Apache-2.0',
});
const LEXEND = notice(
  [
    { spdxId: 'MIT', part: 'code', textKey: 'm' },
    { spdxId: 'OFL-1.1', part: 'font', textKey: 'o' },
  ],
  { displayName: 'Lexend', version: '0.4.1', license: 'MIT AND OFL-1.1' },
);

describe('licenseNames', () => {
  it('names the license of a single-license notice', () => {
    expect(licenseNames(HEROUI)).toBe('Apache 2.0');
  });

  it('joins the names of a compound license with " y "', () => {
    expect(licenseNames(LEXEND)).toBe('MIT y SIL Open Font License 1.1');
  });

  it('does not repeat a license', () => {
    const twice = notice([
      { spdxId: 'MIT', part: 'code', textKey: 'a' },
      { spdxId: 'MIT', part: 'font', textKey: 'b' },
    ]);

    expect(licenseNames(twice)).toBe('MIT');
  });
});

describe('license row texts', () => {
  it('writes the subtitle with the version and the license', () => {
    expect(licenseRowSubtitle(HEROUI)).toBe('Versión 1.0.11 · Apache 2.0');
  });

  it('writes the accessible label with the name first', () => {
    expect(licenseRowLabel(LEXEND)).toBe('Lexend, versión 0.4.1, MIT y SIL Open Font License 1.1');
  });
});

describe('licenseDetailHeading', () => {
  it('names the code and the font part with their license', () => {
    expect(licenseDetailHeading('code', 'MIT')).toBe('Licencia del código: MIT');
    expect(licenseDetailHeading('font', 'SIL Open Font License 1.1')).toBe(
      'Licencia de la fuente: SIL Open Font License 1.1',
    );
  });
});

describe('versionText', () => {
  it('writes the version', () => {
    expect(versionText('1.0.0')).toBe('Versión 1.0.0');
  });

  it.each(['unknown', ''])('gives null when the version is %j', (version) => {
    expect(versionText(version)).toBeNull();
  });
});

describe('backupSummaryText', () => {
  it('gives the phrase without a copy when there is no date', () => {
    expect(backupSummaryText(null)).toBe('Guarda tus datos o expórtalos en planillas');
    expect(BACKUP_SUMMARY_WITHOUT_COPY).toBe('Guarda tus datos o expórtalos en planillas');
  });

  it('mentions the copy with its date and article', () => {
    expect(backupSummaryText({ text: 'hoy, 15:42', isRelative: true })).toBe(
      'Tienes una copia de seguridad de hoy, 15:42',
    );
    expect(backupSummaryText({ text: '13 de noviembre de 2026, 15:42', isRelative: false })).toBe(
      'Tienes una copia de seguridad del 13 de noviembre de 2026, 15:42',
    );
  });
});

describe('every text of the screens', () => {
  it('never blames the person', () => {
    const texts = [
      ...Object.values(SETTINGS_TEXTS).flatMap((value) =>
        typeof value === 'string' ? [value] : Object.values(value),
      ),
      ...Object.values(LICENSES_TEXTS),
      backupSummaryText({ text: 'hoy, 15:42', isRelative: true }),
      backupSummaryText({ text: 'ayer, 9:05', isRelative: true }),
      backupSummaryText({ text: '13 de noviembre de 2026, 15:42', isRelative: false }),
      licenseRowSubtitle(LEXEND),
      licenseDetailHeading('code', 'MIT'),
    ];

    expect(texts.length).toBeGreaterThan(10);
    for (const text of texts) {
      expect(findGuiltPattern(text)).toBeNull();
    }
  });
});

import { z } from 'zod';

/** Route id of a notice: slug of `name@version` (`heroui-native-1-0-11`). */
export const noticeIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,214}$/)
  .brand<'NoticeId'>();
/** Identificador estable de un aviso de licencia. */
export type NoticeId = z.infer<typeof noticeIdSchema>;

/** Part of the package a text applies to when the license is compound (`MIT AND OFL-1.1`). */
export type LicensePart = 'code' | 'font';

/** A license text of a notice, by key in `LICENSE_TEXTS`. */
export interface NoticeText {
  /** SPDX identifier allowed by the policy (ADR-018). */
  readonly spdxId: string;
  /** `null` when the package has a single license. */
  readonly part: LicensePart | null;
  readonly textKey: string;
}

/** Notice of a third-party package that the app includes. */
export interface ThirdPartyNotice {
  readonly id: NoticeId;
  readonly packageName: string;
  /** Name for the person ("HeroUI Native"); the package name when there is no exception. */
  readonly displayName: string;
  readonly version: string;
  /** SPDX expression as the package publishes it. */
  readonly license: string;
  readonly texts: readonly NoticeText[];
}

/** A text of a notice with its content already resolved. */
export interface ResolvedNoticeText {
  readonly spdxId: string;
  readonly part: LicensePart | null;
  readonly text: string;
}

/** Readable name of each allowed license (design 5.5). */
export const LICENSE_LABELS: Readonly<Record<string, string>> = {
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
};

/** Readable name of a license, or its SPDX id when it has none. */
export function licenseLabel(spdxId: string): string {
  return LICENSE_LABELS[spdxId] ?? spdxId;
}

/** The notice with that id, or `null` when it does not exist. */
export function findNotice(
  notices: readonly ThirdPartyNotice[],
  id: NoticeId,
): ThirdPartyNotice | null {
  return notices.find((notice) => notice.id === id) ?? null;
}

/** Name without the leading "@" and in lower case, to order as a person reads it. */
function sortKey(notice: ThirdPartyNotice): string {
  return notice.displayName.replace(/^@/, '').toLowerCase();
}

/** Compares by code units, so the order does not depend on the locale (ADR-015). */
function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/** Compares versions part by part, with the numeric parts as numbers ("7.8.6" before "10.0.0"). */
function compareVersions(left: string, right: string): number {
  const leftParts = left.split(/[.-]/);
  const rightParts = right.split(/[.-]/);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? '';
    const rightPart = rightParts[index] ?? '';
    const bothNumbers = /^\d+$/.test(leftPart) && /^\d+$/.test(rightPart);
    const difference = bothNumbers
      ? Number(leftPart) - Number(rightPart)
      : compareCodeUnits(leftPart, rightPart);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/**
 * Notices in the order of the list (UX-S8): by display name without the leading "@" and
 * ignoring case, then by version. Does not change its input.
 */
export function sortNotices(notices: readonly ThirdPartyNotice[]): readonly ThirdPartyNotice[] {
  return [...notices].sort(
    (left, right) =>
      compareCodeUnits(sortKey(left), sortKey(right)) ||
      compareVersions(left.version, right.version),
  );
}

/** The texts of a notice, resolved from `LICENSE_TEXTS`, in the order of the notice. */
export function noticeTexts(
  notice: ThirdPartyNotice,
  texts: Readonly<Record<string, string>>,
): readonly ResolvedNoticeText[] {
  return notice.texts.map(({ spdxId, part, textKey }) => ({
    spdxId,
    part,
    text: texts[textKey] ?? '',
  }));
}

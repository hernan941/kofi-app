import type { BackupDate } from '@/features/backup';

import { licenseLabel, type LicensePart, type ThirdPartyNotice } from '../domain';

/** Texts of the Ajustes screen (design 5.1). */
export const SETTINGS_TEXTS = {
  title: 'Ajustes',
  reminders: {
    title: 'Recordatorios',
    hint: 'Cambia el día, la hora o apaga los avisos',
  },
  backup: {
    title: 'Respaldo y planillas',
    hint: 'Crea un respaldo, exporta planillas o vuelve a una copia',
  },
  privacy: {
    heading: 'Privacidad',
    first:
      'Tus datos viven en tu teléfono. cuantovendi no tiene cuentas y no envía nada a internet. Tus datos solo salen del teléfono cuando tú compartes un respaldo o una planilla.',
    second:
      'Si borras la app o cambias de teléfono, tus datos no se pasan solos. Para llevarlos contigo, crea un respaldo.',
  },
  about: {
    heading: 'Acerca de',
    name: 'cuantovendi',
    licensesTitle: 'Licencias de terceros',
    licensesSubtitle: 'Bibliotecas de código abierto que usa la app',
    licensesHint: 'Abre la lista de licencias',
  },
} as const;

/** Texts of the license list and detail screens (design 5.4). */
export const LICENSES_TEXTS = {
  title: 'Licencias de terceros',
  introduction:
    'cuantovendi usa bibliotecas de código abierto. Aquí están sus licencias, en orden alfabético. Toca una para leer el texto completo.',
  rowHint: 'Abre el texto completo de la licencia',
} as const;

/** Subtitle of "Respaldo y planillas" when there is no safety copy (design 5.3). */
export const BACKUP_SUMMARY_WITHOUT_COPY = 'Guarda tus datos o expórtalos en planillas';

/** Subtitle of "Respaldo y planillas": mentions the safety copy with its date, if there is one. */
export function backupSummaryText(date: BackupDate | null): string {
  if (date === null) {
    return BACKUP_SUMMARY_WITHOUT_COPY;
  }
  const article = date.isRelative ? 'de' : 'del';
  return `Tienes una copia de seguridad ${article} ${date.text}`;
}

/** "Versión 1.0.0", or `null` when the version is not known (design UX-S6). */
export function versionText(version: string): string | null {
  return version === '' || version === 'unknown' ? null : `Versión ${version}`;
}

/** Readable license names of a notice, without repeats, joined with " y ". */
export function licenseNames(notice: ThirdPartyNotice): string {
  const names = notice.texts.map(({ spdxId }) => licenseLabel(spdxId));
  return [...new Set(names)].join(' y ');
}

/** Subtitle of a row of the license list: "Versión 1.0.11 · Apache 2.0". */
export function licenseRowSubtitle(notice: ThirdPartyNotice): string {
  return `Versión ${notice.version} · ${licenseNames(notice)}`;
}

/** Accessible label of a row of the license list: "HeroUI Native, versión 1.0.11, Apache 2.0". */
export function licenseRowLabel(notice: ThirdPartyNotice): string {
  return `${notice.displayName}, versión ${notice.version}, ${licenseNames(notice)}`;
}

/** Heading of a part of a compound license: "Licencia del código: MIT". */
export function licenseDetailHeading(part: LicensePart, licenseName: string): string {
  const subject = part === 'code' ? 'del código' : 'de la fuente';
  return `Licencia ${subject}: ${licenseName}`;
}

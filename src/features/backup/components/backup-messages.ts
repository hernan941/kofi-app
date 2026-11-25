import type { ExportProblem, RestoreProblem } from '../domain/errors';
import type { ExportProgress } from '../domain/progress';
import { formatStorageSize } from '../domain/storage-size';

/** Lo que se anuncia al intentar salir o iniciar otra acción mientras algo trabaja. */
export const BLOCKED_MESSAGE = 'Espera a que termine.';

/** Qué se está exportando: el respaldo completo o una planilla. */
export type ExportKind = 'backup' | 'sheet';

/** Título, frase y si la vista de problema ofrece "Elegir otro archivo" (F8.1, 5.3). */
export interface RestoreProblemMessage {
  readonly title: string;
  readonly message: string;
  readonly offersAnotherFile: boolean;
}

/** Texto de cada paso de la restauración (F8.1, 3.6). */
export const RESTORE_STEP_LABELS = {
  review: 'Revisar el respaldo',
  safety: 'Guardar la copia de seguridad',
  photos: 'Copiar las fotos',
  apply: 'Aplicar los cambios',
} as const;

const UNEXPECTED_RESTORE: RestoreProblemMessage = {
  title: 'No pudimos terminar',
  message: 'Vuelve a intentarlo en un momento.',
  offersAnotherFile: false,
};

const INCOMPLETE = 'Este respaldo está incompleto';
const TRY_ANOTHER_COPY = 'Prueba con otra copia del respaldo.';

function fileProblem(title: string, message: string): RestoreProblemMessage {
  return { title, message, offersAnotherFile: true };
}

function ownProblem(title: string, message: string): RestoreProblemMessage {
  return { title, message, offersAnotherFile: false };
}

/**
 * Mensaje en español, amable y sin tecnicismos, para cada problema al restaurar (F8.1, 5.3).
 * Nunca dice "error" ni nombra el formato del archivo.
 */
export function restoreProblemMessage(problem: RestoreProblem): RestoreProblemMessage {
  if (problem === 'unexpected') {
    return UNEXPECTED_RESTORE;
  }
  switch (problem.code) {
    case 'not_a_backup':
      return fileProblem(
        'Este archivo no es un respaldo de Kofi',
        'Elige el archivo que creaste con "Crear respaldo". Su nombre empieza con kofi-respaldo (o cuantovendi-respaldo, si lo hiciste antes).',
      );
    case 'emergency_backup':
      return fileProblem(
        'Esta es una copia de emergencia',
        'Guarda tus datos tal como estaban, pero la app no puede restaurarla. Guárdala en un lugar seguro.',
      );
    case 'invalid_archive':
      return problem.reason === 'too_large'
        ? fileProblem(
            'Este archivo es demasiado grande',
            'Es más grande que cualquier respaldo de Kofi. Revisa que sea el archivo correcto.',
          )
        : fileProblem(
            'No pudimos leer este respaldo',
            'El archivo parece dañado o incompleto. Si lo bajaste de tu correo o de Drive, descárgalo de nuevo y vuelve a elegirlo.',
          );
    case 'newer_format':
      return ownProblem(
        'Este respaldo es de una versión más nueva de la app',
        'Actualiza Kofi y vuelve a intentarlo.',
      );
    case 'entries_mismatch':
      return fileProblem(
        INCOMPLETE,
        `Le faltan partes o tiene archivos que no son suyos. ${TRY_ANOTHER_COPY}`,
      );
    case 'checksum_mismatch':
      return fileProblem(
        'Este respaldo cambió desde que se creó',
        `Algunos datos no coinciden con los originales. Para cuidar tu información, no lo usamos. ${TRY_ANOTHER_COPY}`,
      );
    case 'invalid_data':
      return fileProblem(
        'Este respaldo tiene datos que la app no reconoce',
        'Prueba con otro respaldo. Si abriste el archivo en el computador y lo cambiaste, usa la copia original.',
      );
    case 'broken_references':
      return fileProblem(
        INCOMPLETE,
        `Hay ventas o fotos que no coinciden con sus productos. ${TRY_ANOTHER_COPY}`,
      );
    case 'photo_conflict':
      return ownProblem(
        'No pudimos copiar las fotos del respaldo',
        'Una foto del respaldo no coincide con una que ya está en la app. Cierra la app, ábrela de nuevo y vuelve a intentarlo.',
      );
    case 'not_enough_space':
      return ownProblem(
        'No hay espacio suficiente en tu teléfono',
        `Para restaurar necesitas al menos ${formatStorageSize(problem.requiredBytes)} libres. Borra fotos o apps que no uses y vuelve a intentarlo.`,
      );
    case 'current_data_too_large':
      return ownProblem(
        'Tus datos actuales no caben en una copia de seguridad',
        'Antes de restaurar guardamos una copia de cómo está la app, pero hoy tiene más fotos de las que caben en un solo archivo. Guarda tus ventas y productos con "Exportar ventas" y "Exportar productos".',
      );
  }
}

/**
 * Mensaje de un problema al crear un respaldo o una planilla (F8.1, 5.4). `too_large` no ocurre
 * en una planilla, pero tiene mensaje por si acaso.
 */
export function exportProblemMessage(problem: ExportProblem, kind: ExportKind): string {
  const target = kind === 'backup' ? 'el respaldo' : 'la planilla';
  if (problem === 'unexpected') {
    return `No se pudo crear ${target}. Inténtalo de nuevo.`;
  }
  switch (problem.code) {
    case 'not_enough_space':
      return `No hay espacio suficiente para crear ${target}. Libera al menos ${formatStorageSize(problem.requiredBytes)} y vuelve a intentarlo.`;
    case 'too_large':
      return 'Tu respaldo tiene más fotos de las que caben en un solo archivo. Puedes guardar tus ventas y productos con "Exportar ventas" y "Exportar productos".';
    case 'inconsistent_data':
      return `No pudimos crear ${target} porque algunos datos de la app no están completos. Puedes guardar tus ventas y productos con "Exportar ventas" y "Exportar productos".`;
    case 'sharing_unavailable':
      return 'Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo.';
  }
}

/** Lo que se muestra de una fase de exportación: texto, barra y anuncio sin números. */
export interface ExportProgressView {
  readonly label: string;
  readonly progress: { readonly done: number; readonly total: number } | undefined;
  readonly announcement: string;
}

/** Texto de cada fase de "Crear respaldo" (F8.1, 3.2). */
export function exportProgressView(progress: ExportProgress): ExportProgressView {
  switch (progress.phase) {
    case 'reading':
      return {
        label: 'Leyendo tus datos…',
        progress: undefined,
        announcement: 'Leyendo tus datos…',
      };
    case 'hashing_photos':
      return {
        label: `Revisando tus fotos: ${String(progress.done)} de ${String(progress.total)}`,
        progress: { done: progress.done, total: progress.total },
        announcement: 'Revisando tus fotos…',
      };
    case 'writing':
      return {
        label: `Creando el archivo: ${String(progress.done)} de ${String(progress.total)}`,
        progress: { done: progress.done, total: progress.total },
        announcement: 'Creando el archivo…',
      };
    case 'sharing':
      return {
        label: 'Abriendo el menú para compartir…',
        progress: undefined,
        announcement: 'Abriendo el menú para compartir…',
      };
  }
}

/** Entero con punto de miles ("1.250"). */
export function formatCount(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Conteos de una vista previa. */
export interface PreviewCounts {
  readonly products: number;
  readonly saleRecords: number;
  readonly activePhotos: number;
}

/** Etiqueta de la tarjeta de la vista previa: un solo elemento con los tres conteos. */
export function previewCardLabel(title: string, counts: PreviewCounts): string {
  const products = plural(counts.products, 'producto', 'productos');
  const sales = plural(counts.saleRecords, 'venta', 'ventas');
  const photos = plural(counts.activePhotos, 'foto', 'fotos');
  return `${title}: ${products}, ${sales} y ${photos}`;
}

/** Lo que hay hoy en la app, para compararlo con el respaldo en la vista previa (D-45). */
export function currentCountsSentence(counts: PreviewCounts): string {
  if (counts.products === 0 && counts.saleRecords === 0 && counts.activePhotos === 0) {
    return 'Hoy la app no tiene productos, ventas ni fotos.';
  }
  const products = plural(counts.products, 'producto', 'productos');
  const sales = plural(counts.saleRecords, 'venta', 'ventas');
  const photos = plural(counts.activePhotos, 'foto', 'fotos');
  return `Hoy tienes ${products}, ${sales} y ${photos} en la app.`;
}

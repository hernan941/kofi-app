import type { ColorRef, ThemeName } from './theme-tokens';

/** WCAG 2.x minimum for text (4.5:1). */
export const TEXT_MINIMUM = 4.5;

/** WCAG 2.x minimum for control borders, informative icons and focus indicators (3:1). */
export const NON_TEXT_MINIMUM = 3;

/** Both themes, in the order they are checked. */
export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

/** One row of the contrast table in section 2.3 of `docs/design-system.md`. */
export interface ContrastPair {
  readonly label: string;
  readonly foreground: ColorRef;
  readonly background: ColorRef;
  readonly minimum: number;
  readonly documented: Readonly<Record<ThemeName, number>>;
}

/**
 * Every pair of the Bruma contrast table (`docs/design-system.md`, 2.3), with the ratio
 * the document publishes for each theme. A new pair is measured and added to the table
 * and to this list at the same time. The two toast labels are the HeroUI soft
 * foregrounds, `color-mix(in oklab, danger 80%, foreground)` and
 * `color-mix(in oklab, accent 80%, foreground)`.
 */
export const BRUMA_CONTRAST_PAIRS: readonly ContrastPair[] = [
  {
    label: 'texto / fondo',
    foreground: 'foreground',
    background: 'background',
    minimum: TEXT_MINIMUM,
    documented: { light: 14.6, dark: 15.7 },
  },
  {
    label: 'texto / tarjeta',
    foreground: 'foreground',
    background: 'surface',
    minimum: TEXT_MINIMUM,
    documented: { light: 13.0, dark: 13.6 },
  },
  {
    label: 'secundario / fondo',
    foreground: 'muted',
    background: 'background',
    minimum: TEXT_MINIMUM,
    documented: { light: 6.6, dark: 9.0 },
  },
  {
    label: 'secundario / tarjeta',
    foreground: 'muted',
    background: 'surface',
    minimum: TEXT_MINIMUM,
    documented: { light: 5.9, dark: 7.7 },
  },
  {
    label: 'acento / fondo',
    foreground: 'accent',
    background: 'background',
    minimum: TEXT_MINIMUM,
    documented: { light: 7.2, dark: 7.8 },
  },
  {
    label: 'acento / tarjeta',
    foreground: 'accent',
    background: 'surface',
    minimum: TEXT_MINIMUM,
    documented: { light: 6.4, dark: 6.7 },
  },
  {
    label: 'texto sobre acento',
    foreground: 'accent-foreground',
    background: 'accent',
    minimum: TEXT_MINIMUM,
    documented: { light: 7.2, dark: 7.8 },
  },
  {
    label: 'error / fondo',
    foreground: 'danger',
    background: 'background',
    minimum: TEXT_MINIMUM,
    documented: { light: 5.9, dark: 8.0 },
  },
  {
    label: 'error / tarjeta',
    foreground: 'danger',
    background: 'surface',
    minimum: TEXT_MINIMUM,
    documented: { light: 5.2, dark: 6.9 },
  },
  {
    label: 'texto sobre botón de borrar',
    foreground: 'danger-foreground',
    background: 'danger',
    minimum: TEXT_MINIMUM,
    documented: { light: 5.9, dark: 8.0 },
  },
  {
    label: 'placeholder / campo',
    foreground: 'field-placeholder',
    background: 'field-background',
    minimum: TEXT_MINIMUM,
    documented: { light: 6.6, dark: 9.0 },
  },
  {
    label: 'borde de campo / fondo',
    foreground: 'field-border',
    background: 'background',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 6.6, dark: 9.0 },
  },
  {
    label: 'borde de campo / tarjeta',
    foreground: 'field-border',
    background: 'surface',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 5.9, dark: 7.7 },
  },
  {
    label: 'foco / fondo',
    foreground: 'focus',
    background: 'background',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 7.2, dark: 7.8 },
  },
  {
    label: 'foco / tarjeta',
    foreground: 'focus',
    background: 'surface',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 6.4, dark: 6.7 },
  },
  {
    label: 'borde sticker / fondo',
    foreground: 'border',
    background: 'background',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 14.6, dark: 9.0 },
  },
  {
    label: 'borde sticker / tarjeta',
    foreground: 'border',
    background: 'surface',
    minimum: NON_TEXT_MINIMUM,
    documented: { light: 13.0, dark: 7.7 },
  },
  {
    label: 'etiqueta de toast de error / tarjeta',
    foreground: { mix: ['danger', 'foreground'], weight: 0.8 },
    background: 'overlay',
    minimum: TEXT_MINIMUM,
    documented: { light: 6.4, dark: 8.0 },
  },
  {
    label: 'etiqueta de toast de éxito / tarjeta',
    foreground: { mix: ['accent', 'foreground'], weight: 0.8 },
    background: 'overlay',
    minimum: TEXT_MINIMUM,
    documented: { light: 7.5, dark: 7.9 },
  },
];

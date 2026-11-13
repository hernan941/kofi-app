/** An sRGB color with 8-bit channels (0..255). */
export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parses a `#RGB` or `#RRGGBB` hex color. Throws when the value is not a three- or
 * six-digit hex color.
 */
export function parseHexColor(value: string): RgbColor {
  if (!HEX_COLOR.test(value)) {
    throw new Error(`Expected a #RGB or #RRGGBB hex color, got "${value}"`);
  }
  const digits = value.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return {
    red: Number.parseInt(full.slice(0, 2), 16),
    green: Number.parseInt(full.slice(2, 4), 16),
    blue: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** Writes a color as an uppercase `#RRGGBB` hex string. */
export function toHexColor({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Converts an 8-bit sRGB channel to linear light with the sRGB transfer function. */
function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Converts a linear-light channel back to an 8-bit sRGB channel, clamped to 0..255. */
function fromLinear(value: number): number {
  const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

/**
 * Relative luminance of a hex color as defined by WCAG 2.x (0 for black, 1 for white).
 */
export function relativeLuminance(hex: string): number {
  const { red, green, blue } = parseHexColor(hex);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

/**
 * WCAG 2.x contrast ratio between two hex colors, from 1 (identical) to 21 (black on
 * white). The order of the arguments does not matter.
 */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Oklab = readonly [lightness: number, a: number, b: number];

/** Converts an sRGB hex color to OKLab (Björn Ottosson's reference matrices). */
function toOklab(hex: string): Oklab {
  const { red, green, blue } = parseHexColor(hex);
  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Converts an OKLab color back to an sRGB hex color, clamping out-of-gamut channels. */
function fromOklab([lightness, a, b]: Oklab): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHexColor({
    red: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    green: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    blue: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}

/**
 * Mixes two opaque hex colors in OKLab, like CSS `color-mix(in oklab, first W%, second)`.
 * HeroUI derives its `*-soft-foreground` tokens this way, so their contrast can be
 * measured with the same values the app renders. `weight` is the share of `first`, from
 * 0 to 1; any other weight throws.
 */
export function mixInOklab(first: string, second: string, weight: number): string {
  if (!(weight >= 0 && weight <= 1)) {
    throw new Error(`Expected a mix weight between 0 and 1, got ${String(weight)}`);
  }
  const a = toOklab(first);
  const b = toOklab(second);
  return fromOklab([
    a[0] * weight + b[0] * (1 - weight),
    a[1] * weight + b[1] * (1 - weight),
    a[2] * weight + b[2] * (1 - weight),
  ]);
}

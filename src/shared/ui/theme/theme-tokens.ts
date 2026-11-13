import { mixInOklab, parseHexColor, toHexColor } from './contrast';

/** Names of the two themes defined in `src/global.css` (D-12). */
export type ThemeName = 'light' | 'dark';

/** Custom properties of one theme, keyed without the leading `--`. */
export type ThemeTokens = Readonly<Record<string, string>>;

/**
 * A color used in a contrast check: a token name, or an OKLab mix of two tokens like the
 * `color-mix(in oklab, …)` that HeroUI uses for its derived colors.
 */
export type ColorRef =
  string | { readonly mix: readonly [first: string, second: string]; readonly weight: number };

const VARIANT_BLOCK = /@variant\s+(light|dark)\s*\{([^}]*)\}/g;
const DECLARATION = /--([\w-]+)\s*:\s*([^;]+);/g;

/**
 * Reads the light and dark tokens declared in `@variant light { … }` and
 * `@variant dark { … }` blocks of a Uniwind stylesheet. Throws when a theme is missing or
 * declared more than once.
 */
export function readThemeTokens(css: string): Record<ThemeName, ThemeTokens> {
  const found: Partial<Record<ThemeName, ThemeTokens>> = {};
  for (const [, name, body] of css.matchAll(VARIANT_BLOCK)) {
    const theme = name as ThemeName;
    if (found[theme]) {
      throw new Error(`The ${theme} theme is declared more than once`);
    }
    const declarations: Record<string, string> = {};
    for (const [, property = '', value = ''] of (body ?? '').matchAll(DECLARATION)) {
      declarations[property] = value.trim();
    }
    found[theme] = declarations;
  }
  const { light, dark } = found;
  if (!light) throw new Error('The light theme is missing');
  if (!dark) throw new Error('The dark theme is missing');
  return { light, dark };
}

/** Returns the hex value of one token, normalized to uppercase `#RRGGBB`. */
function tokenHex(tokens: ThemeTokens, name: string): string {
  const value = tokens[name];
  if (value === undefined) {
    throw new Error(`Unknown theme token "${name}"`);
  }
  return toHexColor(parseHexColor(value));
}

/**
 * Resolves a color reference against the tokens of one theme. Throws when a token is
 * missing or its value is not a hex color.
 */
export function resolveColor(tokens: ThemeTokens, ref: ColorRef): string {
  if (typeof ref === 'string') {
    return tokenHex(tokens, ref);
  }
  const [first, second] = ref.mix;
  return mixInOklab(tokenHex(tokens, first), tokenHex(tokens, second), ref.weight);
}

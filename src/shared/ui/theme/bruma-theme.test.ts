import * as lexend from '@expo-google-fonts/lexend';

import { contrastRatio } from './contrast';
import { BRUMA_CONTRAST_PAIRS, THEME_NAMES } from './contrast-pairs';
import { readThemeTokens, resolveColor } from './theme-tokens';

/** The slice of Node's `fs` this test needs; the project does not ship `@types/node`. */
interface FileReader {
  readFileSync(path: string, encoding: 'utf8'): string;
}

/** Reads `src/global.css`, located three folders above this test file. */
function readGlobalCss(): string {
  const testPath = expect.getState().testPath ?? '';
  const srcFolder = testPath.replace(/[\\/]shared[\\/]ui[\\/]theme[\\/][^\\/]+$/, '');
  if (srcFolder === testPath) {
    throw new Error(`Unexpected test location: ${testPath}`);
  }
  return jest.requireActual<FileReader>('fs').readFileSync(`${srcFolder}/global.css`, 'utf8');
}

const GLOBAL_CSS = readGlobalCss();
const tokens = readThemeTokens(GLOBAL_CSS);

/** Reads a custom property declared in the `@theme` block (shared by both themes). */
function themeValue(name: string): string | undefined {
  const match = new RegExp(`@theme\\s*\\{[^}]*--${name}:\\s*([^;]+);`).exec(GLOBAL_CSS);
  return match?.[1]?.trim();
}

const cases = THEME_NAMES.flatMap((theme) =>
  BRUMA_CONTRAST_PAIRS.map((pair) => ({ theme, ...pair, documented: pair.documented[theme] })),
);

describe('Bruma contrast (docs/design-system.md, table 2.3)', () => {
  it.each(cases)(
    '$theme: $label reaches $minimum:1 and matches the documented $documented',
    ({ theme, foreground, background, minimum, documented }) => {
      const ratio = contrastRatio(
        resolveColor(tokens[theme], foreground),
        resolveColor(tokens[theme], background),
      );

      expect(ratio).toBeGreaterThanOrEqual(minimum);
      expect(Math.abs(ratio - documented)).toBeLessThan(0.1);
    },
  );

  it('covers every row of the table in both themes', () => {
    expect(BRUMA_CONTRAST_PAIRS).toHaveLength(19);
    expect(cases).toHaveLength(38);
  });
});

describe('Bruma tokens in global.css', () => {
  it('declares the same tokens in light and dark', () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort());
  });

  it.each(THEME_NAMES)('%s: derived tokens reuse the three base tones', (theme) => {
    const t = tokens[theme];

    expect(t).toMatchObject({
      'surface-foreground': t.foreground,
      'surface-secondary': t.background,
      'surface-tertiary': t.background,
      overlay: t.surface,
      'overlay-foreground': t.foreground,
      default: t.surface,
      'default-foreground': t.foreground,
      'accent-foreground': t.background,
      focus: t.accent,
      link: t.accent,
      success: t.accent,
      'success-foreground': t.background,
      warning: t.muted,
      'warning-foreground': t.background,
      'danger-foreground': t.background,
      'field-background': t.background,
      'field-foreground': t.foreground,
      'field-placeholder': t.muted,
      'field-border': t.muted,
      segment: t.background,
      'segment-foreground': t.foreground,
    });
  });

  it.each(THEME_NAMES)('%s: sticker shadows are solid offsets in the shadow color', (theme) => {
    const t = tokens[theme];
    const color = t['sticker-shadow-color'];

    expect(t['sticker-shadow']).toBe(`3px 3px 0 0 ${String(color)}`);
    expect(t['sticker-shadow-pressed']).toBe(`1px 1px 0 0 ${String(color)}`);
    expect(t['surface-shadow']).toBe(t['sticker-shadow']);
    expect(t['overlay-shadow']).toBe(t['sticker-shadow']);
  });

  it('uses the sticker border color of the design system', () => {
    expect(tokens.light.border).toBe(tokens.light.foreground);
    expect(tokens.dark.border).toBe(tokens.dark.muted);
    expect(tokens.light['sticker-shadow-color']).toBe(tokens.light.foreground);
    expect(tokens.dark['sticker-shadow-color']).toBe('#000000');
  });

  it('points the HeroUI font variables to the Lexend faces loaded with useFonts', () => {
    expect(themeValue('font-normal')).toBe("'Lexend_400Regular'");
    expect(themeValue('font-medium')).toBe("'Lexend_500Medium'");
    expect(themeValue('font-semibold')).toBe("'Lexend_600SemiBold'");
    expect(themeValue('font-bold')).toBe("'Lexend_700Bold'");
  });

  it('only names font faces that @expo-google-fonts/lexend exports as useFonts keys', () => {
    const faces = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'].map((name) =>
      String(themeValue(name)).replace(/'/g, ''),
    );

    expect(Object.keys(lexend)).toEqual(expect.arrayContaining(faces));
  });

  it('sets the sticker borders, radii and disabled opacity', () => {
    expect(themeValue('border-width')).toBe('2px');
    expect(themeValue('field-border-width')).toBe('2px');
    expect(themeValue('radius')).toBe('0.5rem');
    expect(themeValue('field-radius')).toBe('1rem');
    expect(themeValue('opacity-disabled')).toBe('0.6');
  });

  it('defines the type scale of section 3.2, nothing below 13', () => {
    expect(themeValue('text-xs')).toBe('0.8125rem');
    expect(themeValue('text-display')).toBe('2.75rem');
    expect(themeValue('text-display--line-height')).toBe('3.25rem');
  });
});

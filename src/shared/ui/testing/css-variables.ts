import { readThemeTokens, type ThemeTokens } from '../theme/theme-tokens';

/** The slice of Node's `fs` this helper needs; the project does not ship `@types/node`. */
interface FileReader {
  readFileSync(path: string, encoding: 'utf8'): string;
}

const FALLBACK_COLOR = '#000000';
const COLOR_PREFIX = '--color-';
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

let lightTokens: ThemeTokens | undefined;

/** Reads the light tokens of `src/global.css`, located from the running test file. */
function readLightTokens(): ThemeTokens {
  if (lightTokens) {
    return lightTokens;
  }
  const testPath = expect.getState().testPath ?? '';
  const sourceIndex = testPath.lastIndexOf('/src/');
  if (sourceIndex < 0) {
    throw new Error(`Unexpected test location: ${testPath}`);
  }
  const css = jest
    .requireActual<FileReader>('fs')
    .readFileSync(`${testPath.slice(0, sourceIndex)}/src/global.css`, 'utf8');
  lightTokens = readThemeTokens(css).light;
  return lightTokens;
}

/**
 * Resolves a Uniwind CSS variable in tests with the light Bruma theme, since the compiled
 * stylesheet only exists in Metro. `--color-*` variables return their hex value; any other
 * variable, or a color that is not a plain hex value, returns black.
 */
export function resolveTestCssVariable(name: string): string {
  const token = name.startsWith(COLOR_PREFIX) ? name.slice(COLOR_PREFIX.length) : name.slice(2);
  const value = readLightTokens()[token];
  return value !== undefined && HEX_COLOR.test(value) ? value : FALLBACK_COLOR;
}

/** Test double of Uniwind's `useCSSVariable`, with the same single-or-list signature. */
export function useTestCssVariable(name: string | readonly string[]): string | string[] {
  return typeof name === 'string' ? resolveTestCssVariable(name) : name.map(resolveTestCssVariable);
}

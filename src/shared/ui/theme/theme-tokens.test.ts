import { readThemeTokens, resolveColor } from './theme-tokens';

const CSS = `
@theme {
  --font-normal: 'Lexend_400Regular';
}

@layer theme {
  :root {
    @variant light {
      --background: #E7EFF3;
      --accent: #743A59;
      --separator: color-mix(in oklab, #D5E3EA 70%, #171D21 30%);
    }

    @variant dark {
      --background: #131A1E;
      --accent: #D79BBB;
    }
  }
}
`;

describe('readThemeTokens', () => {
  it('reads the custom properties of each theme variant', () => {
    const tokens = readThemeTokens(CSS);

    expect(tokens.light).toEqual({
      background: '#E7EFF3',
      accent: '#743A59',
      separator: 'color-mix(in oklab, #D5E3EA 70%, #171D21 30%)',
    });
    expect(tokens.dark).toEqual({ background: '#131A1E', accent: '#D79BBB' });
  });

  it('fails when a theme variant is missing', () => {
    expect(() => readThemeTokens('@variant light { --background: #fff; }')).toThrow(/dark/);
  });

  it('fails when a theme variant is declared twice', () => {
    const twice = `${CSS}\n@variant dark { --background: #000; }`;

    expect(() => readThemeTokens(twice)).toThrow(/dark/);
  });
});

describe('resolveColor', () => {
  const theme = { background: '#E7EFF3', foreground: '#171D21', accent: '#743A59' };

  it('returns the hex value of a token', () => {
    expect(resolveColor(theme, 'accent')).toBe('#743A59');
  });

  it('mixes two tokens in OKLab', () => {
    expect(resolveColor(theme, { mix: ['accent', 'accent'], weight: 0.8 })).toBe('#743A59');
    expect(resolveColor(theme, { mix: ['background', 'foreground'], weight: 1 })).toBe('#E7EFF3');
  });

  it('fails for an unknown token', () => {
    expect(() => resolveColor(theme, 'surface')).toThrow(/surface/);
  });

  it('fails for a token that is not a hex color', () => {
    expect(() =>
      resolveColor({ separator: 'color-mix(in oklab, red, blue)' }, 'separator'),
    ).toThrow(/hex color/);
  });
});

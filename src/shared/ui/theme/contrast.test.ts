import {
  contrastRatio,
  mixInOklab,
  parseHexColor,
  relativeLuminance,
  toHexColor,
} from './contrast';

describe('parseHexColor', () => {
  it('reads six-digit hex colors in any case', () => {
    expect(parseHexColor('#743A59')).toEqual({ red: 116, green: 58, blue: 89 });
    expect(parseHexColor('#743a59')).toEqual({ red: 116, green: 58, blue: 89 });
  });

  it('expands three-digit hex colors', () => {
    expect(parseHexColor('#fa0')).toEqual({ red: 255, green: 170, blue: 0 });
  });

  it.each(['743A59', '#74', '#GGGGGG', '#743A5980', 'red', ''])('rejects %p', (value) => {
    expect(() => parseHexColor(value)).toThrow(/hex color/);
  });
});

describe('toHexColor', () => {
  it('writes uppercase six-digit hex colors', () => {
    expect(toHexColor({ red: 116, green: 58, blue: 89 })).toBe('#743A59');
    expect(toHexColor({ red: 0, green: 5, blue: 255 })).toBe('#0005FF');
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('weights the channels as WCAG 2.x defines', () => {
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance('#00FF00')).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance('#0000FF')).toBeCloseTo(0.0722, 4);
  });

  it('linearizes dark channels with the linear segment of sRGB', () => {
    expect(relativeLuminance('#0A0A0A')).toBeCloseTo(10 / 255 / 12.92, 6);
  });
});

describe('contrastRatio', () => {
  it('is 21 between black and white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
  });

  it('is 1 between a color and itself', () => {
    expect(contrastRatio('#743A59', '#743A59')).toBe(1);
  });

  it('does not depend on the order of the colors', () => {
    expect(contrastRatio('#171D21', '#E7EFF3')).toBe(contrastRatio('#E7EFF3', '#171D21'));
  });

  it('places #777777 on white just below the 4.5:1 text minimum', () => {
    const ratio = contrastRatio('#777777', '#FFFFFF');

    expect(ratio).toBeCloseTo(4.48, 2);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe('mixInOklab', () => {
  it('returns the first color when its weight is 1 and the second when it is 0', () => {
    expect(mixInOklab('#743A59', '#171D21', 1)).toBe('#743A59');
    expect(mixInOklab('#743A59', '#171D21', 0)).toBe('#171D21');
  });

  it('mixes black and white halfway at the OKLab lightness midpoint', () => {
    expect(mixInOklab('#000000', '#FFFFFF', 0.5)).toBe('#636363');
  });

  it('rejects weights outside 0..1', () => {
    expect(() => mixInOklab('#000000', '#FFFFFF', 1.2)).toThrow(/weight/);
    expect(() => mixInOklab('#000000', '#FFFFFF', -0.1)).toThrow(/weight/);
  });
});

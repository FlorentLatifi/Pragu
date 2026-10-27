import { describe, expect, it } from 'vitest';
import { contrastRatio, estimateTextColors, formatRatio, relativeLuminance, toHex } from '../src/index.js';
import { createRaster, fillRect, paintText, rect } from './helpers.js';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(0x000000)).toBe(0);
    expect(relativeLuminance(0xffffff)).toBeCloseTo(1, 10);
  });

  it('weights green far more than blue, as the eye does', () => {
    expect(relativeLuminance(0x00ff00)).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(0x0000ff)).toBeCloseTo(0.0722, 4);
  });

  it('uses the linear segment for very dark channels', () => {
    expect(relativeLuminance(0x0a0a0a)).toBeCloseTo(10 / 255 / 12.92, 6);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for identical colours', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 6);
    expect(contrastRatio(0x777777, 0x777777)).toBe(1);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio(0x1f5e4b, 0xffffff)).toBe(contrastRatio(0xffffff, 0x1f5e4b));
  });

  it('matches well-known reference pairs', () => {
    // #767676 is the lightest grey that still reaches 4.5:1 on white.
    expect(contrastRatio(0x767676, 0xffffff)).toBeCloseTo(4.54, 2);
    expect(contrastRatio(0xa3a3a3, 0xffffff)).toBeCloseTo(2.52, 2);
    expect(contrastRatio(0x595959, 0xffffff)).toBeCloseTo(7.0, 1);
  });
});

describe('formatRatio', () => {
  it('truncates instead of rounding, so a failing ratio never displays as passing', () => {
    expect(formatRatio(4.499)).toBe('4.49');
    expect(formatRatio(2.5249)).toBe('2.52');
    expect(formatRatio(21)).toBe('21.00');
  });
});

describe('toHex', () => {
  it('pads to six upper-case digits', () => {
    expect(toHex(0x1a2b3c)).toBe('#1A2B3C');
    expect(toHex(0x000000)).toBe('#000000');
  });
});

describe('estimateTextColors', () => {
  it('finds the glyph colour and background, ignoring lighter anti-aliased pixels', () => {
    const raster = createRaster(200, 60, 0xffffff);
    paintText(raster, rect(10, 10, 190, 50), 0xa3a3a3, 0xd6d6d6);

    const colors = estimateTextColors(raster, rect(10, 10, 190, 50));

    expect(colors).not.toBeNull();
    expect(colors?.foreground).toBe(0xa3a3a3);
    expect(colors?.background).toBe(0xffffff);
    expect(colors?.ratio).toBeCloseTo(2.52, 2);
    expect(colors?.backgroundShare).toBeGreaterThan(0.4);
  });

  it('returns null when the area is too small to sample', () => {
    const raster = createRaster(10, 10, 0xffffff);
    expect(estimateTextColors(raster, rect(0, 0, 3, 3))).toBeNull();
  });

  it('returns null when no colour dominates, e.g. text over a photo', () => {
    const raster = createRaster(40, 40, 0xffffff);
    fillRect(raster, rect(0, 0, 20, 20), 0x112233);
    fillRect(raster, rect(20, 0, 40, 20), 0x445566);
    fillRect(raster, rect(0, 20, 20, 40), 0x778899);
    fillRect(raster, rect(20, 20, 40, 40), 0xaabbcc);
    expect(estimateTextColors(raster, rect(0, 0, 40, 40))).toBeNull();
  });

  it('returns null when there is nothing but background', () => {
    const raster = createRaster(40, 40, 0xf2efe6);
    expect(estimateTextColors(raster, rect(0, 0, 40, 40))).toBeNull();
  });

  it('clamps rectangles that reach past the screenshot edges', () => {
    const raster = createRaster(100, 40, 0x1a1a18);
    paintText(raster, rect(0, 0, 100, 40), 0xffffff, 0x8c8c8b);
    const colors = estimateTextColors(raster, rect(-20, -20, 140, 80));
    expect(colors?.foreground).toBe(0xffffff);
    expect(colors?.background).toBe(0x1a1a18);
  });
});

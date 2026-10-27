import type { Rect } from './model.js';

/** Decoded screenshot pixels: 4 bytes per pixel (RGBA), row-major. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

/** WCAG 2.2 relative luminance of a 0xRRGGBB colour. */
export function relativeLuminance(rgb: number): number {
  return (
    0.2126 * channelToLinear((rgb >> 16) & 0xff) +
    0.7152 * channelToLinear((rgb >> 8) & 0xff) +
    0.0722 * channelToLinear(rgb & 0xff)
  );
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). Order does not matter. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function toHex(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** WCAG forbids rounding a failing ratio up, so display values are truncated, never rounded. */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

export interface TextColors {
  foreground: number;
  background: number;
  ratio: number;
  /** Share of sampled pixels in the background colour; low values mean a busy background. */
  backgroundShare: number;
}

const MIN_SAMPLE_PIXELS = 16;
const MIN_BACKGROUND_SHARE = 0.4;
const MIN_FOREGROUND_SHARE = 0.003;
const MIN_FOREGROUND_PIXELS = 3;

/**
 * Estimates the text and background colours inside `rect`.
 *
 * The most frequent colour is taken as the background. Among the other frequent
 * colours, the one with the highest contrast against it is taken as the text.
 * Anti-aliased edge pixels are blends that contrast less than the solid glyph
 * core, so they never win. When the background is too busy to call (an image,
 * a gradient), it returns null rather than guess: a missed issue costs less trust
 * than a false alarm.
 */
export function estimateTextColors(raster: Raster, rect: Rect): TextColors | null {
  const inset = rect.right - rect.left > 4 && rect.bottom - rect.top > 4 ? 1 : 0;
  const left = clamp(Math.round(rect.left) + inset, 0, raster.width);
  const right = clamp(Math.round(rect.right) - inset, 0, raster.width);
  const top = clamp(Math.round(rect.top) + inset, 0, raster.height);
  const bottom = clamp(Math.round(rect.bottom) - inset, 0, raster.height);
  const total = Math.max(0, right - left) * Math.max(0, bottom - top);
  if (total < MIN_SAMPLE_PIXELS) return null;

  const counts = new Map<number, number>();
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const rgb = pixelAt(raster, x, y);
      counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
    }
  }

  let background = 0;
  let backgroundCount = 0;
  for (const [color, count] of counts) {
    if (count > backgroundCount) {
      background = color;
      backgroundCount = count;
    }
  }
  const backgroundShare = backgroundCount / total;
  if (backgroundShare < MIN_BACKGROUND_SHARE) return null;

  const minForeground = Math.max(MIN_FOREGROUND_PIXELS, total * MIN_FOREGROUND_SHARE);
  let foreground: number | null = null;
  let bestRatio = 1;
  for (const [color, count] of counts) {
    if (color === background || count < minForeground) continue;
    const ratio = contrastRatio(color, background);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      foreground = color;
    }
  }
  if (foreground === null) return null;
  return { foreground, background, ratio: bestRatio, backgroundShare };
}

function pixelAt(raster: Raster, x: number, y: number): number {
  const offset = (y * raster.width + x) * 4;
  const { data } = raster;
  return ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

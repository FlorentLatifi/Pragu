import type { ReportScreenshot } from '@pragu/report';
import { PNG } from 'pngjs';

/** Twice the report's 360 px screenshot column, so the image stays sharp on high-density displays. */
export const REPORT_SCREENSHOT_WIDTH = 720;

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, row by row. */
  data: Uint8Array;
}

/**
 * Shrinks an image to `maxWidth` by averaging each target pixel's source area (a box
 * filter): plain arithmetic, so the same capture always gives the same bytes. Images
 * already narrow enough come back unchanged.
 */
export function downscale(image: Pixels, maxWidth: number): Pixels {
  if (image.width <= maxWidth) return image;
  const width = maxWidth;
  const height = Math.max(1, Math.round((image.height * maxWidth) / image.width));
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const top = Math.floor(y * scaleY);
    const bottom = Math.max(top + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < width; x++) {
      const left = Math.floor(x * scaleX);
      const right = Math.max(left + 1, Math.floor((x + 1) * scaleX));
      const sums = [0, 0, 0, 0];
      for (let sy = top; sy < bottom; sy++) {
        for (let sx = left; sx < right; sx++) {
          const from = (sy * image.width + sx) * 4;
          for (let channel = 0; channel < 4; channel++)
            sums[channel] = (sums[channel] ?? 0) + (image.data[from + channel] ?? 0);
        }
      }
      const count = (bottom - top) * (right - left);
      const to = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) data[to + channel] = Math.round((sums[channel] ?? 0) / count);
    }
  }
  return { width, height, data };
}

/** The screenshot as the report embeds it: downscaled, as PNG. Analysis always uses the full-size capture. */
export function reportScreenshot(png: Buffer): ReportScreenshot {
  const decoded = PNG.sync.read(png);
  const small = downscale(
    { width: decoded.width, height: decoded.height, data: decoded.data },
    REPORT_SCREENSHOT_WIDTH,
  );
  if (small.width === decoded.width) return { mimeType: 'image/png', base64: png.toString('base64') };
  const out = new PNG({ width: small.width, height: small.height });
  out.data = Buffer.from(small.data);
  // Screenshots are opaque: dropping the alpha channel makes the PNG about a tenth smaller.
  return { mimeType: 'image/png', base64: PNG.sync.write(out, { colorType: 2 }).toString('base64') };
}

// Android does not refuse a screenshot of a secure window (FLAG_SECURE, common in banking
// apps): it paints the window solid black. Checking contrast on that would be checking a
// black rectangle, so such a screen is treated as having no screenshot (D-03).

import type { Raster } from './color.js';
import type { PamScreen } from './model.js';

function allBlack(raster: Raster, left: number, top: number, right: number, bottom: number): boolean {
  for (let y = Math.max(0, top); y < Math.min(raster.height, bottom); y++) {
    for (let x = Math.max(0, left); x < Math.min(raster.width, right); x++) {
      const i = (y * raster.width + x) * 4;
      if (raster.data[i] !== 0 || raster.data[i + 1] !== 0 || raster.data[i + 2] !== 0) return false;
    }
  }
  return true;
}

/**
 * True when every visible text in the app's topmost window sits on pure black pixels: the
 * text is in the tree but not in the picture. A real dark screen still shows its text, so
 * it is never mistaken for a blocked one.
 */
export function screenshotBlocked(screen: PamScreen, raster: Raster): boolean {
  const foreground = screen.windows.findIndex((window) => window.foreground);
  const texts = screen.nodes.filter(
    (node) => node.window === foreground && node.visible && node.text !== null && node.text.trim() !== '',
  );
  return (
    texts.length > 0 &&
    texts.every(({ boundsPx }) => allBlack(raster, boundsPx.left, boundsPx.top, boundsPx.right, boundsPx.bottom))
  );
}

import type { Rect } from './model.js';

export function rectWidth(rect: Rect): number {
  return rect.right - rect.left;
}

export function rectHeight(rect: Rect): number {
  return rect.bottom - rect.top;
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

export function scaleRect(rect: Rect, factor: number): Rect {
  return {
    left: rect.left * factor,
    top: rect.top * factor,
    right: rect.right * factor,
    bottom: rect.bottom * factor,
  };
}

/** Shortest distance between the edges of two rectangles; 0 when they touch or overlap. */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.left - a.right, a.left - b.right);
  const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  return Math.hypot(dx, dy);
}

/** True when `outer` covers every point of `inner`. */
export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom
  );
}

/** True when the rectangles share some area (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function circleIntersectsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const nearestX = Math.min(Math.max(cx, rect.left), rect.right);
  const nearestY = Math.min(Math.max(cy, rect.top), rect.bottom);
  return Math.hypot(cx - nearestX, cy - nearestY) < radius;
}

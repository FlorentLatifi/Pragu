import { describe, expect, it } from 'vitest';
import { screenshotBlocked } from '../src/index.js';
import { createRaster, fillRect, pamNode, screenOf, rect } from './helpers.js';

describe('screenshotBlocked', () => {
  const text = (id: string, bounds = rect(10, 10, 90, 30)) => pamNode({ id, text: 'Balance', boundsPx: bounds });

  it('spots a secure window: text in the tree, solid black in the picture', () => {
    const black = createRaster(100, 100, 0x000000);
    expect(screenshotBlocked(screenOf([text('0.0'), text('0.1', rect(10, 50, 90, 70))]), black)).toBe(true);
  });

  it('leaves a dark screen alone, since its text still shows', () => {
    const dark = createRaster(100, 100, 0x000000);
    fillRect(dark, rect(20, 15, 40, 25), 0xffffff);
    expect(screenshotBlocked(screenOf([text('0.0'), text('0.1', rect(10, 50, 90, 70))]), dark)).toBe(false);
  });

  it('needs visible text in the app to judge, and ignores other windows', () => {
    const black = createRaster(100, 100, 0x000000);
    expect(screenshotBlocked(screenOf([]), black)).toBe(false);
    expect(screenshotBlocked(screenOf([pamNode({ id: '0.0', text: 'Hidden', visible: false })]), black)).toBe(false);
  });
});

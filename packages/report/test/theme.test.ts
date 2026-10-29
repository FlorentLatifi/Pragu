import { contrastRatio } from '@pragu/core';
import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, TEXT_PAIRS, UI_PAIRS, themeCss } from '../src/theme.js';
import type { ThemeTokens } from '../src/theme.js';

const rgb = (hex: string) => Number.parseInt(hex.slice(1), 16);

// Measured with the same function Pragu uses on apps: the report must pass its own check.
describe.each([
  ['light', LIGHT],
  ['dark', DARK],
] as const)('%s theme', (_name, tokens: ThemeTokens) => {
  it.each(TEXT_PAIRS)('%s text on %s reaches 4.5:1', (text, background) => {
    expect(contrastRatio(rgb(tokens[text]), rgb(tokens[background]))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('%s on %s reaches 3:1', (part, background) => {
    expect(contrastRatio(rgb(tokens[part]), rgb(tokens[background]))).toBeGreaterThanOrEqual(3);
  });
});

describe('themeCss', () => {
  it('defaults to light, follows the system, and lets the toggle win', () => {
    const css = themeCss();
    expect(css).toContain(':root { --bg: #ffffff;');
    expect(css).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0d0d0d;');
    expect(css).toContain(':root[data-theme="dark"] { --bg: #0d0d0d;');
  });
});

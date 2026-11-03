import { describe, expect, it } from 'vitest';
import { genericName, nonTextContrast, platformTargetSize } from '../src/index.js';
import type { PamNode, Raster, Rule } from '../src/index.js';
import { createRaster, fillRect, pamNode, rect, screenOf } from './helpers.js';

const device = {} as never;
const run = (rule: Rule, nodes: PamNode[], raster: Raster | null = null) =>
  rule.check({ screen: screenOf(nodes), device, raster }).map((finding) => finding.node.id);
// pamNode bounds are 1:1 px to dp in these tests.
const target = (id: string, size: number, extra: Partial<PamNode> = {}) =>
  pamNode({
    id,
    role: 'button',
    interactive: true,
    name: 'Add',
    boundsDp: rect(0, 0, size, size),
    boundsPx: rect(0, 0, size, size),
    ...extra,
  });

describe('target/platform-size (info)', () => {
  it('reports a 40 dp target as info: it passes WCAG 2.5.8 but misses Android’s 48 dp guidance', () => {
    const findings = platformTargetSize.check({ screen: screenOf([target('0.0', 40)]), device, raster: null });
    expect(findings.map((finding) => finding.node.id)).toEqual(['0.0']);
    expect(platformTargetSize.meta.severity).toBe('info');
    expect(findings[0]?.message).toContain('40×40 dp');
  });

  it('accepts a 48 dp target, and leaves targets under 24 dp to target/size', () => {
    expect(run(platformTargetSize, [target('0.0', 48), target('0.1', 16), target('0.2', 60)])).toEqual([]);
  });

  it('does not flag a Compose control whose touch area is already enlarged to 48 dp', () => {
    expect(run(platformTargetSize, [target('0.0', 48, { boundsAreTouchArea: true })])).toEqual([]);
    expect(
      run(platformTargetSize, [target('0.0', 40, { role: 'textfield' }), target('0.1', 40, { enabled: false })]),
    ).toEqual([]);
  });
});

describe('name/generic (warning)', () => {
  const named = (id: string, name: string, role: PamNode['role'] = 'button') =>
    pamNode({ id, role, name, interactive: role !== 'image' });

  it('flags a name that only repeats the role, such as "Button" on a button', () => {
    expect(
      run(genericName, [named('0.0', 'Button'), named('0.1', ' Icon '), named('0.2', 'Click here', 'link')]),
    ).toEqual(['0.0', '0.1', '0.2']);
  });

  it('flags resource-like names: ic_close, img_1234.png, button1', () => {
    expect(
      run(genericName, [
        named('0.0', 'ic_close'),
        named('0.1', 'img_1234.png', 'image'),
        named('0.2', 'button1'),
        named('0.3', 'add_to_cart'),
      ]),
    ).toEqual(['0.0', '0.1', '0.2', '0.3']);
  });

  it('accepts short real names such as "Close", "Back" and "Add to wishlist"', () => {
    expect(
      run(genericName, [
        named('0.0', 'Close'),
        named('0.1', 'Back'),
        named('0.2', 'Add to wishlist'),
        named('0.3', 'More options'),
        named('0.4', 'Image of a mug', 'image'),
      ]),
    ).toEqual([]);
  });

  it('ignores unnamed controls, which name/interactive-missing reports', () => {
    expect(run(genericName, [pamNode({ id: '0.0', role: 'button', interactive: true, name: null })])).toEqual([]);
    expect(run(genericName, [pamNode({ id: '0.0', role: 'text', name: 'Button', interactive: false })])).toEqual([]);
  });
});

describe('contrast/non-text (warning)', () => {
  const icon = (color: number) => {
    const raster = createRaster(48, 48, 0xffffff);
    fillRect(raster, rect(14, 14, 34, 34), color);
    return raster;
  };
  const button = (extra: Partial<PamNode> = {}) =>
    pamNode({
      id: '0.0',
      role: 'button',
      interactive: true,
      name: 'Favourite',
      boundsPx: rect(0, 0, 48, 48),
      boundsDp: rect(0, 0, 48, 48),
      ...extra,
    });

  it('flags a pale icon button under 3:1 against its background', () => {
    // #C8C8C8 on white is 1.6:1.
    expect(run(nonTextContrast, [button()], icon(0xc8c8c8))).toEqual(['0.0']);
  });

  it('accepts a dark icon at 3:1 or more', () => {
    expect(run(nonTextContrast, [button()], icon(0x5e5c57))).toEqual([]);
  });

  it('stays silent on busy backgrounds and on disabled controls', () => {
    const busy = createRaster(48, 48, 0xffffff);
    for (let x = 0; x < 48; x += 2) fillRect(busy, rect(x, 0, x + 1, 48), (x * 5000) & 0xffffff);
    expect(run(nonTextContrast, [button()], busy)).toEqual([]);
    expect(run(nonTextContrast, [button({ enabled: false })], icon(0xc8c8c8))).toEqual([]);
    expect(run(nonTextContrast, [button({ text: 'Save' })], icon(0xc8c8c8))).toEqual([]);
    expect(run(nonTextContrast, [button()], null)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { analyze, fnv1a64, issueFingerprint, normalizeAndroidCapture, summarize } from '../src/index.js';
import type { Rule } from '../src/index.js';
import { captureOf, createRaster, device, fillRect, paintText, pamNode, rawNode, rect, screenOf } from './helpers.js';

// A miniature of the rn-shop fixture at density 1 (px = dp): three seeded barriers and their correct twins.
function cartScreen() {
  const root = rawNode({
    bounds: [0, 0, 400, 400],
    children: [
      rawNode({
        resourceId: 'promo-apply',
        clickable: true,
        bounds: [100, 20, 200, 68],
        children: [rawNode({ text: 'Apply code', bounds: [110, 30, 190, 58] })],
      }),
      rawNode({
        resourceId: 'seed-tiny-dismiss',
        clickable: true,
        contentDescription: 'Dismiss promotion',
        bounds: [202, 36, 218, 52],
      }),
      rawNode({
        resourceId: 'seed-unlabeled-remove',
        className: 'android.widget.Button',
        clickable: true,
        bounds: [300, 100, 348, 148],
      }),
      rawNode({
        resourceId: 'twin-labeled-remove',
        className: 'android.widget.Button',
        clickable: true,
        contentDescription: 'Remove Linen tote bag',
        bounds: [300, 160, 348, 208],
      }),
      rawNode({
        resourceId: 'seed-low-contrast',
        className: 'android.widget.TextView',
        text: 'Free shipping on orders over €50',
        textSizePx: 14,
        bounds: [10, 250, 390, 290],
      }),
      rawNode({
        resourceId: 'twin-good-contrast',
        className: 'android.widget.TextView',
        text: 'Delivery in 2–4 working days',
        textSizePx: 14,
        bounds: [10, 300, 390, 340],
      }),
    ],
  });
  const normalized = normalizeAndroidCapture(captureOf(root), {
    screenId: 'screen-1',
    screenName: 'Cart',
    screenshotFile: null,
  });
  const raster = createRaster(400, 400, 0xffffff);
  fillRect(raster, rect(100, 20, 200, 68), 0x1f5e4b);
  paintText(raster, rect(110, 30, 190, 58), 0xffffff, 0x8faea5);
  paintText(raster, rect(10, 250, 390, 290), 0xa3a3a3, 0xd6d6d6);
  paintText(raster, rect(10, 300, 390, 340), 0x595959, 0xacacac);
  return { ...normalized, rasters: new Map([['screen-1', raster]]) };
}

describe('analyze', () => {
  it('finds exactly the three seeded barriers, in reading order', () => {
    const { screen, rasters } = cartScreen();
    const issues = analyze({ device, screens: [screen], rasters });
    expect(issues.map((issue) => [issue.ruleId, issue.resourceId])).toEqual([
      ['target/size', 'seed-tiny-dismiss'],
      ['name/interactive-missing', 'seed-unlabeled-remove'],
      ['contrast/text', 'seed-low-contrast'],
    ]);
  });

  it('copies the rule metadata onto each issue', () => {
    const { screen, rasters } = cartScreen();
    const [first] = analyze({ device, screens: [screen], rasters });
    expect(first).toMatchObject({
      title: 'Touch target is too small',
      severity: 'warning',
      confidence: 'medium',
      wcag: ['2.5.8'],
      screenId: 'screen-1',
      nodeId: '0.1',
    });
    expect(first?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(first?.fix.reactNative).toContain('hitSlop');
  });

  it('skips pixel rules on screens without a screenshot', () => {
    const { screen } = cartScreen();
    const issues = analyze({ device, screens: [screen], rasters: new Map() });
    expect(issues.map((issue) => issue.ruleId)).toEqual(['target/size', 'name/interactive-missing']);
  });

  it('lets a finding override the rule severity, and keeps the order deterministic', () => {
    const rule: Rule = {
      meta: {
        id: 'test/rule',
        title: 'Test',
        severity: 'error',
        confidence: 'high',
        wcag: [],
        en301549: [],
        whoIsAffected: 'x',
        whatTheyExperience: 'y',
        fix: { reactNative: '', compose: '', androidViews: '' },
      },
      check: ({ screen }) =>
        screen.nodes.map((node) => ({
          node,
          message: 'm',
          evidence: {},
          severity: node.id === '1' ? 'warning' : 'error',
        })),
    };
    const screen = screenOf([
      pamNode({ id: '0', boundsDp: rect(0, 50, 10, 60) }),
      pamNode({ id: '1', boundsDp: rect(0, 10, 10, 20) }),
      pamNode({ id: '2', boundsDp: rect(5, 10, 15, 20) }),
    ]);
    const issues = analyze({ device, screens: [screen], rasters: new Map(), rules: [rule] });
    expect(issues.map((issue) => [issue.nodeId, issue.severity])).toEqual([
      ['1', 'warning'],
      ['2', 'error'],
      ['0', 'error'],
    ]);
  });
});

describe('summarize', () => {
  it('counts issues by severity and lists the rules that ran', () => {
    const { screen, rasters } = cartScreen();
    const summary = summarize(analyze({ device, screens: [screen], rasters }));
    expect(summary).toEqual({
      errors: 2,
      warnings: 1,
      infos: 0,
      rulesRun: [
        'name/interactive-missing',
        'name/image-missing',
        'input/missing-label',
        'state/not-exposed',
        'contrast/text',
        'target/size',
      ],
    });
  });
});

describe('fingerprints', () => {
  it('match the published FNV-1a 64-bit test vectors', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64('foobar')).toBe('85944171f73967e8');
  });

  it('are stable for the same issue and differ between rules', () => {
    const node = pamNode({ id: '0.3', resourceId: 'checkout' });
    const a = issueFingerprint('target/size', 'com.example.shop', 'Cart', node);
    expect(issueFingerprint('target/size', 'com.example.shop', 'Cart', { ...node, id: '0.9' })).toBe(a);
    expect(issueFingerprint('name/interactive-missing', 'com.example.shop', 'Cart', node)).not.toBe(a);
  });

  it('fall back to role, name and text when there is no resource id', () => {
    const node = pamNode({ id: '0', resourceId: null, name: null, text: null });
    const named = pamNode({ id: '0', resourceId: null, name: 'Save', text: 'Save' });
    expect(issueFingerprint('r', 'app', 'Cart', node)).not.toBe(issueFingerprint('r', 'app', 'Cart', named));
  });
});

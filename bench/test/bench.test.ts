import type { Issue } from '@pragu/core';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { captureOf, createRaster, paintText, rawNode, rect } from '../../packages/core/test/helpers.js';
import { evaluate } from '../src/evaluate.js';
import type { BenchResult } from '../src/evaluate.js';
import { compareWithBaseline, errorRulesBelowBar } from '../src/gate.js';
import { f1, formatMetric, mcc, precision, recall, truncate } from '../src/metrics.js';
import { containsResourceId } from '../src/record.js';
import { analyzeRecording } from '../src/recordings.js';
import { renderMarkdown } from '../src/report.js';
import { parseGroundTruth } from '../src/truth.js';
import type { TruthScreen } from '../src/truth.js';

const RULES = [
  { id: 'name/interactive-missing', severity: 'error' as const },
  { id: 'target/size', severity: 'error' as const },
];

function issue(ruleId: string, resourceId: string | null, nodeId = '0.1'): Issue {
  return { ruleId, resourceId, nodeId, message: `${ruleId} finding` } as Issue;
}

const screen: TruthScreen = {
  id: 'cart',
  name: 'Cart',
  url: 'shop://cart',
  marker: 'screen-cart',
  barriers: [
    { rule: 'name/interactive-missing', testID: 'seed-a' },
    { rule: 'name/interactive-missing', testID: 'seed-b' },
    { rule: 'state/not-exposed', testID: 'seed-c' },
  ],
  correctTwins: [
    { rule: 'name/interactive-missing', testID: 'twin-a' },
    { rule: 'name/interactive-missing', testID: 'twin-b', note: 'labelled by its child text' },
    { rule: 'target/size', testID: 'twin-c' },
  ],
};

describe('metrics', () => {
  const counts = { tp: 8, fp: 2, fn: 2, tn: 8 };

  it('computes precision, recall, F1 and MCC', () => {
    expect(precision(counts)).toBe(0.8);
    expect(recall(counts)).toBe(0.8);
    expect(f1(counts)).toBeCloseTo(0.8, 10);
    expect(mcc(counts)).toBeCloseTo(0.6, 10);
  });

  it('is undefined rather than zero when there is nothing to measure', () => {
    const empty = { tp: 0, fp: 0, fn: 0, tn: 5 };
    expect(precision(empty)).toBeNull();
    expect(recall(empty)).toBeNull();
    expect(f1(empty)).toBeNull();
    expect(mcc(empty)).toBeNull();
    expect(f1({ tp: 0, fp: 3, fn: 3, tn: 0 })).toBeNull();
  });

  it('never rounds a published number up', () => {
    expect(truncate(0.8999, 2)).toBe(0.89);
    expect(truncate(-0.4567, 2)).toBe(-0.45);
    expect(formatMetric(0.8999)).toBe('0.89');
    expect(formatMetric(null)).toBe('n/a');
  });
});

describe('evaluate', () => {
  it('scores reported issues against barriers and correct twins', () => {
    const result = evaluate(
      [
        {
          fixture: 'shop',
          screen,
          issues: [
            issue('name/interactive-missing', 'seed-a'),
            issue('name/interactive-missing', 'twin-b'),
            issue('target/size', null, '0.7'),
          ],
        },
      ],
      RULES,
    );
    expect(result.rules.map(({ rule, tp, fp, fn, tn }) => ({ rule, tp, fp, fn, tn }))).toEqual([
      { rule: 'name/interactive-missing', tp: 1, fp: 1, fn: 1, tn: 1 },
      { rule: 'target/size', tp: 0, fp: 1, fn: 0, tn: 1 },
    ]);
    expect(result.rules[0]?.precision).toBe(0.5);
    expect(result.falsePositives).toEqual([
      {
        fixture: 'shop',
        screen: 'cart',
        rule: 'name/interactive-missing',
        element: 'twin-b',
        note: 'labelled by its child text',
        message: 'name/interactive-missing finding',
      },
      { fixture: 'shop', screen: 'cart', rule: 'target/size', element: 'node 0.7', message: 'target/size finding' },
    ]);
    expect(result.falseNegatives).toEqual([
      { fixture: 'shop', screen: 'cart', rule: 'name/interactive-missing', element: 'seed-b' },
    ]);
  });

  it('keeps labels for rules that do not exist yet, without scoring them', () => {
    const result = evaluate([{ fixture: 'shop', screen, issues: [] }], RULES);
    expect(result.awaiting).toEqual([{ rule: 'state/not-exposed', barriers: 1, correctTwins: 0 }]);
    expect(result.rules.map((rule) => rule.rule)).toEqual(['name/interactive-missing', 'target/size']);
    expect(result).toMatchObject({ benchVersion: 1, fixtures: ['shop'], screens: 1 });
  });
});

describe('gate', () => {
  const baseline = evaluate(
    [{ fixture: 'shop', screen, issues: [issue('name/interactive-missing', 'seed-a')] }],
    RULES,
  );

  it('passes when the results match the published baseline exactly', () => {
    const again = evaluate([{ fixture: 'shop', screen, issues: [issue('name/interactive-missing', 'seed-a')] }], RULES);
    expect(compareWithBaseline(again, baseline)).toEqual({ ok: true, messages: [] });
  });

  it('calls out a precision drop as a regression', () => {
    const worse = evaluate(
      [
        {
          fixture: 'shop',
          screen,
          issues: [issue('name/interactive-missing', 'seed-a'), issue('name/interactive-missing', 'twin-a')],
        },
      ],
      RULES,
    );
    const outcome = compareWithBaseline(worse, baseline);
    expect(outcome.ok).toBe(false);
    expect(outcome.messages[0]).toBe(
      'Regression in name/interactive-missing: precision 1.00 → 0.50 (FP 0 → 1, TN 2 → 1).',
    );
  });

  it('asks for an update when results improve, so published numbers stay exact', () => {
    const better = evaluate(
      [
        {
          fixture: 'shop',
          screen,
          issues: [issue('name/interactive-missing', 'seed-a'), issue('name/interactive-missing', 'seed-b')],
        },
      ],
      RULES,
    );
    const outcome = compareWithBaseline(better, baseline);
    expect(outcome.ok).toBe(false);
    expect(outcome.messages[0]).toBe('Changed name/interactive-missing: TP 1 → 2, FN 1 → 0.');
    expect(outcome.messages.at(-1)).toContain('pnpm bench:update');
  });

  it('notices new, missing and changed details', () => {
    expect(compareWithBaseline(baseline, null).ok).toBe(false);
    const extraRule = {
      ...baseline,
      rules: [...baseline.rules, { ...baseline.rules[0], rule: 'new/rule' }],
    } as BenchResult;
    expect(compareWithBaseline(extraRule, baseline).messages[0]).toBe('New rule new/rule: not in the baseline yet.');
    expect(compareWithBaseline(baseline, extraRule).messages[0]).toBe('Rule new/rule disappeared.');
    const moreScreens = { ...baseline, screens: 2 };
    expect(compareWithBaseline(moreScreens, baseline).messages[0]).toBe('Screens: 1 → 2.');
    const relabelled = { ...baseline, awaiting: [] };
    expect(compareWithBaseline(relabelled, baseline).messages[0]).toContain('Same counts');
  });

  it('lists error rules below the precision bar', () => {
    const noisy = evaluate([{ fixture: 'shop', screen, issues: [issue('target/size', 'twin-c')] }], RULES);
    expect(errorRulesBelowBar(noisy).map((rule) => rule.rule)).toEqual(['name/interactive-missing', 'target/size']);
  });
});

describe('ground truth', () => {
  const valid = { fixture: 'shop', appId: 'com.example', screens: [{ ...screen }] };

  it('accepts a valid file and keeps notes', () => {
    expect(parseGroundTruth(valid, 'expected.json').screens[0]?.correctTwins[1]?.note).toBe(
      'labelled by its child text',
    );
  });

  it('explains what is wrong, with the path', () => {
    expect(() => parseGroundTruth([], 'x.json')).toThrow('x.json must be an object.');
    expect(() => parseGroundTruth({ ...valid, screens: [] }, 'x.json')).toThrow('"screens" must be a non-empty array.');
    expect(() => parseGroundTruth({ ...valid, appId: '' }, 'x.json')).toThrow(
      'x.json: "appId" must be a non-empty string.',
    );
    expect(() => parseGroundTruth({ ...valid, screens: [screen, screen] }, 'x.json')).toThrow(
      'duplicate screen id "cart"',
    );
    expect(() => parseGroundTruth({ ...valid, screens: [{ ...screen, barriers: {} }] }, 'x.json')).toThrow(
      'x.json screens[0].barriers must be an array.',
    );
  });
});

describe('recordings', () => {
  function recording() {
    const root = rawNode({
      bounds: [0, 0, 200, 100],
      children: [
        rawNode({
          resourceId: 'screen-cart',
          className: 'android.widget.TextView',
          text: 'Cart',
          textSizePx: 28,
          bounds: [10, 10, 190, 50],
        }),
        rawNode({
          resourceId: 'seed-a',
          className: 'android.widget.Button',
          clickable: true,
          bounds: [10, 50, 58, 98],
        }),
      ],
    });
    const raster = createRaster(200, 100, 0xffffff);
    paintText(raster, rect(10, 10, 190, 50), 0x1a1a18, 0x8c8c8b);
    const png = new PNG({ width: 200, height: 100 });
    png.data = Buffer.from(raster.data);
    return { capture: { ...captureOf(root), screenWidthPx: 200, screenHeightPx: 100 }, png: PNG.sync.write(png) };
  }

  it('runs the scan pipeline on a recorded capture', () => {
    const { capture, png } = recording();
    const issues = analyzeRecording(capture, png, screen);
    expect(issues.map((found) => [found.ruleId, found.resourceId])).toEqual([['name/interactive-missing', 'seed-a']]);
    expect(containsResourceId(capture.root, 'seed-a')).toBe(true);
  });

  it('rejects a recording of the wrong screen', () => {
    const { capture, png } = recording();
    expect(() => analyzeRecording(capture, png, { ...screen, marker: 'screen-product' })).toThrow(
      'marker "screen-product" is missing',
    );
  });
});

describe('markdown report', () => {
  it('publishes counts, the bar, misses and awaiting rules', () => {
    const result = evaluate(
      [{ fixture: 'shop', screen, issues: [issue('name/interactive-missing', 'twin-b')] }],
      RULES,
    );
    const markdown = renderMarkdown(result);
    // MCC = (0·1 − 1·2) / √(1·2·2·3) = −0.577…, truncated toward zero.
    expect(markdown).toContain(
      '| `name/interactive-missing` | error | 0 | 1 | 2 | 1 | 0.00 | 0.00 | n/a | -0.57 | **below 0.90** |',
    );
    expect(markdown).toContain(
      '- `name/interactive-missing` on `twin-b` (shop › cart): labelled by its child text — name/interactive-missing finding',
    );
    expect(markdown).toContain('- `state/not-exposed`: 1 barriers, 0 correct twins labelled');
    expect(renderMarkdown({ ...result, falsePositives: [], falseNegatives: [], awaiting: [] })).toContain('None.');
  });
});

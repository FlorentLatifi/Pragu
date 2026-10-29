import { describe, expect, it } from 'vitest';
import { compareWithBaseline, createBaseline, parseBaseline } from '../src/index.js';
import type { Issue, PamScreen, ScanResult } from '../src/index.js';
import { screenOf } from './helpers.js';

const issue = (fingerprint: string, overrides: Partial<Issue> = {}): Issue => ({
  ruleId: 'name/interactive-missing',
  title: 't',
  severity: 'error',
  confidence: 'high',
  screenId: 'screen-1',
  nodeId: '0',
  resourceId: null,
  fingerprint,
  message: `issue ${fingerprint}`,
  whoIsAffected: 'w',
  whatTheyExperience: 'e',
  wcag: [],
  en301549: [],
  boundsPx: { left: 0, top: 0, right: 1, bottom: 1 },
  evidence: {},
  fix: { reactNative: '', compose: '', androidViews: '' },
  inBaseline: false,
  ...overrides,
});

const screen: PamScreen = { ...screenOf([]), name: 'Cart' };
const result = (issues: Issue[]) =>
  ({ tool: { version: '0.0.0' }, app: { id: 'shop' }, screens: [screen], issues }) as unknown as ScanResult;

describe('baselines', () => {
  it('accept every issue of a scan, sorted so the file diffs cleanly', () => {
    const baseline = createBaseline(
      result([issue('b'), issue('a', { ruleId: 'contrast/text' })]),
      '2026-10-29T12:00:00.000Z',
    );
    expect(baseline).toMatchObject({ baselineVersion: 1, tool: 'pragu 0.0.0', app: 'shop' });
    expect(baseline.issues.map((entry) => [entry.ruleId, entry.fingerprint, entry.screen])).toEqual([
      ['contrast/text', 'a', 'Cart'],
      ['name/interactive-missing', 'b', 'Cart'],
    ]);
  });

  it('mark known and new issues, and count fixes only on the screens scanned', () => {
    const baseline = createBaseline(result([issue('known'), issue('fixed')]), 'now');
    baseline.issues.push({
      fingerprint: 'other-screen',
      ruleId: 'r',
      screen: 'Checkout',
      resourceId: null,
      message: 'm',
    });
    const { issues, comparison } = compareWithBaseline([issue('known'), issue('new')], [screen], baseline);
    expect(issues.map((found) => found.inBaseline)).toEqual([true, false]);
    expect(comparison).toEqual({ newIssues: 1, known: 1, fixed: 1 });
  });

  it.each([
    [[], 'a baseline must be a JSON object'],
    [{ baselineVersion: 2 }, 'baselineVersion 2 is not supported'],
    [{ baselineVersion: 1, createdAt: 'x', tool: 't', app: 'a', issues: {} }, '"issues" must be an array'],
    [
      { baselineVersion: 1, createdAt: 'x', tool: 't', app: 'a', issues: [{ fingerprint: 'f' }] },
      'issues[0].ruleId must be a string',
    ],
  ])('reject a broken file: %j', (value, message) => {
    expect(() => parseBaseline(value, 'pragu-baseline.json')).toThrow(message);
  });
});

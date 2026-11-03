import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultRules, penaltyShare, ruleWeight, scoreResult, scoreScreen } from '../src/index.js';
import type { Issue, Rule } from '../src/index.js';
import { pamNode, screenOf } from './helpers.js';

const screen = { ...screenOf([pamNode({ id: '0.0' })]), screenshot: { file: 's.png', widthPx: 1, heightPx: 1 } };

function issue(ruleId: string, nodeId: string, screenId = screen.id): Issue {
  return { ruleId, nodeId, screenId } as Issue;
}

const weighted = defaultRules.filter((rule) => ruleWeight(rule.meta) > 0 && rule.meta.requires === undefined);
const arbIssues = fc.array(
  fc.record({ rule: fc.constantFrom(...weighted.map((rule) => rule.meta.id)), node: fc.integer({ min: 0, max: 5 }) }),
  { maxLength: 12 },
);
const toIssues = (picked: { rule: string; node: number }[]) =>
  picked.map(({ rule, node }) => issue(rule, `0.${String(node)}`));

describe('Pragu score', () => {
  // The worked example (bench recordings) is checked end to end in the CLI tests.
  it('weighs by default severity and confidence, and takes 75% of a rule for its first barrier', () => {
    const contrast = defaultRules.find((rule) => rule.meta.id === 'contrast/text');
    const target = defaultRules.find((rule) => rule.meta.id === 'target/size');
    expect(contrast && ruleWeight(contrast.meta)).toBe(100);
    expect(target && ruleWeight(target.meta)).toBe(21);
    expect([0, 1, 2, 3].map(penaltyShare)).toEqual([0, 0.75, 0.875, 0.9375]);
  });

  it('is 100 exactly when no weighted finding exists, and never leaves 0–100', () => {
    fc.assert(
      fc.property(arbIssues, (picked) => {
        const value = scoreScreen(screen, toIssues(picked), defaultRules) ?? -1;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
        expect(value === 100).toBe(picked.length === 0);
      }),
    );
  });

  it('drops strictly when a weighted finding is added, and does not depend on issue order', () => {
    fc.assert(
      fc.property(arbIssues, fc.constantFrom(...weighted.map((rule) => rule.meta.id)), (picked, rule) => {
        const issues = toIssues(picked);
        const before = scoreScreen(screen, issues, defaultRules) ?? 0;
        const after = scoreScreen(screen, [...issues, issue(rule, '0.99')], defaultRules) ?? 0;
        expect(after).toBeLessThan(before);
        expect(scoreScreen(screen, [...issues].reverse(), defaultRules)).toBe(before);
      }),
    );
  });

  it('leaves out a rule whose input is missing on the screen, instead of counting it as passed', () => {
    const noShot = { ...screen, screenshot: null };
    const rules = defaultRules.filter((rule) => ['contrast/text', 'name/interactive-missing'].includes(rule.meta.id));
    // Without a screenshot only the name rule counts, so one unnamed button takes 75% of the score.
    expect(scoreScreen(noShot, [issue('name/interactive-missing', '0.0')], rules)).toBe(25);
    expect(scoreScreen(screen, [issue('name/interactive-missing', '0.0')], rules)).toBe(62.5);
  });

  it('uses default severities, so a config override does not change the score', () => {
    const issues = [{ ...issue('target/size', '0.0'), severity: 'error' as const }];
    const summary = { rulesRun: defaultRules.map((rule) => rule.meta.id) };
    const asDefault = scoreResult({ screens: [screen], issues: [issue('target/size', '0.0')], summary } as never);
    const overridden = scoreResult({ screens: [screen], issues, summary } as never);
    expect(overridden).toEqual(asDefault);
    expect(asDefault.version).toBe(1);
    expect(scoreResult({ screens: [screen], issues: [], summary: { rulesRun: [] } } as never).value).toBeNull();
    const unscored: readonly Rule[] = [];
    expect(scoreScreen(screen, [], unscored)).toBeNull();
  });
});

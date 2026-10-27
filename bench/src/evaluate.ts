import type { Issue, Severity } from '@pragu/core';
import { f1, mcc, precision, recall, truncate } from './metrics.js';
import type { Counts } from './metrics.js';
import type { TruthScreen } from './truth.js';

export interface ScreenOutcome {
  fixture: string;
  screen: TruthScreen;
  issues: Issue[];
}

/** A wrong answer, kept with enough context to review it. */
export interface Miss {
  fixture: string;
  screen: string;
  rule: string;
  element: string;
  note?: string;
  message?: string;
}

export interface RuleResult extends Counts {
  rule: string;
  severity: Severity;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  mcc: number | null;
}

export interface BenchResult {
  benchVersion: 1;
  fixtures: string[];
  screens: number;
  rules: RuleResult[];
  falsePositives: Miss[];
  falseNegatives: Miss[];
  /** Labelled rules that Pragu does not implement yet, with their label counts. */
  awaiting: { rule: string; barriers: number; correctTwins: number }[];
}

/**
 * Scores every implemented rule against the labels. A reported issue is a true
 * positive when its rule and element match a barrier; any other reported issue is a
 * false positive (on a twin, or on an element nobody labelled). An unreported barrier
 * is a false negative; an unflagged twin is a true negative.
 */
export function evaluate(
  outcomes: readonly ScreenOutcome[],
  rules: readonly { id: string; severity: Severity }[],
): BenchResult {
  const falsePositives: Miss[] = [];
  const falseNegatives: Miss[] = [];
  const results = rules.map(({ id, severity }) => {
    const counts: Counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const { fixture, screen, issues } of outcomes) {
      const barriers = screen.barriers.filter((label) => label.rule === id);
      const twins = screen.correctTwins.filter((label) => label.rule === id);
      const reported = issues.filter((issue) => issue.ruleId === id);
      const reportedIds = new Set(reported.flatMap((issue) => (issue.resourceId === null ? [] : [issue.resourceId])));
      const barrierIds = new Set(barriers.map((label) => label.testID));

      for (const barrier of barriers) {
        if (reportedIds.has(barrier.testID)) counts.tp++;
        else {
          counts.fn++;
          falseNegatives.push(
            withNote({ fixture, screen: screen.id, rule: id, element: barrier.testID }, barrier.note),
          );
        }
      }
      for (const issue of reported) {
        if (issue.resourceId !== null && barrierIds.has(issue.resourceId)) continue;
        counts.fp++;
        const element = issue.resourceId ?? `node ${issue.nodeId}`;
        const twin = twins.find((label) => label.testID === issue.resourceId);
        falsePositives.push(
          withNote({ fixture, screen: screen.id, rule: id, element, message: issue.message }, twin?.note),
        );
      }
      counts.tn += twins.filter((label) => !reportedIds.has(label.testID)).length;
    }
    return {
      rule: id,
      severity,
      ...counts,
      precision: fourDecimals(precision(counts)),
      recall: fourDecimals(recall(counts)),
      f1: fourDecimals(f1(counts)),
      mcc: fourDecimals(mcc(counts)),
    };
  });

  const implemented = new Set(rules.map((rule) => rule.id));
  const awaiting = new Map<string, { barriers: number; correctTwins: number }>();
  for (const { screen } of outcomes) {
    for (const label of screen.barriers) if (!implemented.has(label.rule)) bump(awaiting, label.rule).barriers++;
    for (const label of screen.correctTwins)
      if (!implemented.has(label.rule)) bump(awaiting, label.rule).correctTwins++;
  }

  return {
    benchVersion: 1,
    fixtures: [...new Set(outcomes.map((outcome) => outcome.fixture))].sort(),
    screens: outcomes.length,
    rules: results,
    falsePositives: falsePositives.sort(byPlace),
    falseNegatives: falseNegatives.sort(byPlace),
    awaiting: [...awaiting.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([rule, n]) => ({ rule, ...n })),
  };
}

function withNote(miss: Miss, note: string | undefined): Miss {
  return note === undefined ? miss : { ...miss, note };
}

function bump(map: Map<string, { barriers: number; correctTwins: number }>, rule: string) {
  let entry = map.get(rule);
  if (entry === undefined) {
    entry = { barriers: 0, correctTwins: 0 };
    map.set(rule, entry);
  }
  return entry;
}

function fourDecimals(value: number | null): number | null {
  return value === null ? null : truncate(value, 4);
}

function byPlace(a: Miss, b: Miss): number {
  return (
    a.fixture.localeCompare(b.fixture) ||
    a.screen.localeCompare(b.screen) ||
    a.rule.localeCompare(b.rule) ||
    a.element.localeCompare(b.element)
  );
}

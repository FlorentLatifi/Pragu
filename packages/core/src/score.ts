// The Pragu score (ADR-012): 0–100 from the automated checks. Deterministic, weighted by each
// rule's default severity and confidence, and never a claim of compliance.

import type { Issue, PamScreen, ScanResult } from './model.js';
import { defaultRules } from './rules/index.js';
import type { Rule, RuleMeta } from './rules/index.js';

export const SCORE_VERSION = 1;

// Weights in tenths, so no floating-point noise reaches the sums: error 10 × high 1.0 = 100.
const SEVERITY_WEIGHT = { error: 10, warning: 3, info: 0 } as const;
const CONFIDENCE_TENTHS = { high: 10, medium: 7, low: 4 } as const;

/** A rule's weight from its default metadata, never from config, so scores compare across projects. */
export function ruleWeight(meta: RuleMeta): number {
  return SEVERITY_WEIGHT[meta.severity] * CONFIDENCE_TENTHS[meta.confidence];
}

/** Share of a rule's weight that `f` reported elements take: 75% for the first, then half of what is left. */
export function penaltyShare(failures: number): number {
  return failures === 0 ? 0 : 1 - 0.5 ** (failures + 1);
}

/** Whether the screen has what the rule reads; a rule without its input is left out, not counted as passed. */
function hasInputs(screen: PamScreen, meta: RuleMeta): boolean {
  return (meta.requires ?? []).every((input) =>
    input === 'screenshot' ? screen.screenshot !== null : screen.largeText !== null,
  );
}

/** One screen's score, unrounded; null when no weighted rule could run on it. */
export function scoreScreen(screen: PamScreen, issues: readonly Issue[], rules: readonly Rule[]): number | null {
  let total = 0;
  let penalty = 0;
  for (const { meta } of rules) {
    const weight = ruleWeight(meta);
    if (weight === 0 || !hasInputs(screen, meta)) continue;
    const failures = new Set(
      issues.filter((issue) => issue.screenId === screen.id && issue.ruleId === meta.id).map((issue) => issue.nodeId),
    ).size;
    total += weight;
    penalty += weight * penaltyShare(failures);
  }
  return total === 0 ? null : 100 * (1 - penalty / total);
}

export interface Score {
  version: typeof SCORE_VERSION;
  /** The scan's score: the mean of its screens', floored. Null when no screen could be scored. */
  value: number | null;
  /** Each screen's score, floored, by screen id. */
  screens: Record<string, number | null>;
}

/**
 * The scan's score from its result: issues after config (ignored ones are out, baseline ones
 * count) and the rules that ran, with their default metadata.
 */
export function scoreResult(
  result: Pick<ScanResult, 'screens' | 'issues' | 'summary'>,
  allRules: readonly Rule[] = defaultRules,
): Score {
  const rules = allRules.filter((rule) => result.summary.rulesRun.includes(rule.meta.id));
  const raw = result.screens.map((screen) => [screen.id, scoreScreen(screen, result.issues, rules)] as const);
  const scored = raw.flatMap(([, value]) => (value === null ? [] : [value]));
  return {
    version: SCORE_VERSION,
    value: scored.length === 0 ? null : Math.floor(scored.reduce((sum, value) => sum + value, 0) / scored.length),
    screens: Object.fromEntries(raw.map(([id, value]) => [id, value === null ? null : Math.floor(value)])),
  };
}

/** Two scores say something about each other only with the same formula and the same rules (ADR-012). */
export function comparableScores(
  head: Pick<ScanResult, 'score' | 'summary'>,
  base: Pick<ScanResult, 'score' | 'summary'>,
): boolean {
  return (
    head.score.version === base.score.version &&
    head.score.value !== null &&
    base.score.value !== null &&
    head.summary.rulesRun.join() === base.summary.rulesRun.join()
  );
}

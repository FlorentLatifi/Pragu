import type { BenchResult, RuleResult } from './evaluate.js';
import { formatMetric } from './metrics.js';

/** The precision every shipped "error" rule must reach on the bench (M1 exit criterion). */
export const ERROR_RULE_MIN_PRECISION = 0.9;

export interface GateOutcome {
  ok: boolean;
  messages: string[];
}

/**
 * The committed results are the published numbers, so CI demands an exact match:
 * a drop in precision or recall is a regression, and any other change means the
 * published table is stale. Either way the fix is explicit.
 */
export function compareWithBaseline(current: BenchResult, baseline: BenchResult | null): GateOutcome {
  if (baseline === null) {
    return { ok: false, messages: ['No baseline yet. Run "pnpm bench:update" and commit bench/results.json.'] };
  }
  const messages: string[] = [];
  const before = new Map(baseline.rules.map((rule) => [rule.rule, rule]));
  for (const rule of current.rules) {
    const previous = before.get(rule.rule);
    if (previous === undefined) {
      messages.push(`New rule ${rule.rule}: not in the baseline yet.`);
      continue;
    }
    const regressions = [drop('precision', previous, rule), drop('recall', previous, rule)].filter((m) => m !== null);
    if (regressions.length > 0) {
      messages.push(`Regression in ${rule.rule}: ${regressions.join('; ')} (${countsDiff(previous, rule)}).`);
    } else if (countsDiff(previous, rule) !== '') {
      messages.push(`Changed ${rule.rule}: ${countsDiff(previous, rule)}.`);
    }
  }
  for (const previous of baseline.rules) {
    if (!current.rules.some((rule) => rule.rule === previous.rule)) messages.push(`Rule ${previous.rule} disappeared.`);
  }
  if (current.screens !== baseline.screens) {
    messages.push(`Screens: ${String(baseline.screens)} → ${String(current.screens)}.`);
  }
  if (messages.length === 0 && JSON.stringify(current) !== JSON.stringify(baseline)) {
    messages.push('Same counts, but the listed false positives, false negatives or labels changed.');
  }
  if (messages.length > 0) {
    messages.push(
      'If the change is intended, run "pnpm bench:update" and commit bench/results.json and docs/bench/results.md.',
    );
  }
  return { ok: messages.length === 0, messages };
}

/** Error rules below the precision bar. Reported now; it becomes a release gate at the end of M1. */
export function errorRulesBelowBar(result: BenchResult): RuleResult[] {
  return result.rules.filter(
    (rule) => rule.severity === 'error' && (rule.precision === null || rule.precision < ERROR_RULE_MIN_PRECISION),
  );
}

function drop(metric: 'precision' | 'recall', before: RuleResult, after: RuleResult): string | null {
  const a = before[metric];
  const b = after[metric];
  if (a === null || b === null || b >= a) return null;
  return `${metric} ${formatMetric(a)} → ${formatMetric(b)}`;
}

function countsDiff(before: RuleResult, after: RuleResult): string {
  return (['tp', 'fp', 'fn', 'tn'] as const)
    .filter((key) => before[key] !== after[key])
    .map((key) => `${key.toUpperCase()} ${String(before[key])} → ${String(after[key])}`)
    .join(', ');
}

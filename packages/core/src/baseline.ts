// Baselines let an existing app adopt Pragu: issues already accepted do not fail the
// build, new ones do (brief: "respect existing apps"). Issues are matched by fingerprint
// (ADR-004). Each entry also keeps the issue's features, so fuzzy matching can be added
// later without regenerating baselines.

import type { Issue, PamScreen, ScanResult } from './model.js';

export const BASELINE_VERSION = 1;

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  screen: string;
  resourceId: string | null;
  /** What the issue said when it was accepted, so a person can review the baseline. */
  message: string;
}

export interface Baseline {
  baselineVersion: typeof BASELINE_VERSION;
  createdAt: string;
  tool: string;
  app: string;
  issues: BaselineEntry[];
}

export interface BaselineComparison {
  /** Issues not in the baseline: the only ones that can fail a build. */
  newIssues: number;
  /** Issues the baseline already accepts. */
  known: number;
  /** Baseline issues on the scanned screens that this scan no longer finds. */
  fixed: number;
  fixedIssues: BaselineEntry[];
}

function screenNames(screens: readonly PamScreen[]): Map<string, string> {
  return new Map(screens.map((screen) => [screen.id, screen.name]));
}

/** Accepts every issue of a result. Entries are sorted, so a baseline diffs cleanly in review. */
export function createBaseline(result: ScanResult, createdAt: string): Baseline {
  const names = screenNames(result.screens);
  const issues = result.issues
    .map((issue) => ({
      fingerprint: issue.fingerprint,
      ruleId: issue.ruleId,
      screen: names.get(issue.screenId) ?? issue.screenId,
      resourceId: issue.resourceId,
      message: issue.message,
    }))
    .sort(
      (a, b) =>
        a.screen.localeCompare(b.screen) ||
        a.ruleId.localeCompare(b.ruleId) ||
        a.fingerprint.localeCompare(b.fingerprint),
    );
  return {
    baselineVersion: BASELINE_VERSION,
    createdAt,
    tool: `pragu ${result.tool.version}`,
    app: result.app.id,
    issues,
  };
}

/** Validates a baseline file; errors name the file and the field. */
export function parseBaseline(value: unknown, source: string): Baseline {
  const fail = (problem: string): never => {
    throw new Error(`${source}: ${problem}`);
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('a baseline must be a JSON object.');
  const baseline = value as Record<string, unknown>;
  if (baseline.baselineVersion !== BASELINE_VERSION) {
    fail(
      `baselineVersion ${String(baseline.baselineVersion)} is not supported; this Pragu reads version ${String(BASELINE_VERSION)}.`,
    );
  }
  for (const key of ['createdAt', 'tool', 'app']) {
    if (typeof baseline[key] !== 'string') fail(`"${key}" must be a string.`);
  }
  if (!Array.isArray(baseline.issues)) fail('"issues" must be an array.');
  (baseline.issues as unknown[]).forEach((entry, index) => {
    const item = entry as Record<string, unknown> | null;
    for (const key of ['fingerprint', 'ruleId', 'screen', 'message']) {
      if (typeof item?.[key] !== 'string') fail(`issues[${String(index)}].${key} must be a string.`);
    }
  });
  return value as Baseline;
}

/** Marks each issue as known or new, and counts what was fixed on the screens this scan covered. */
export function compareWithBaseline(
  issues: readonly Issue[],
  screens: readonly PamScreen[],
  baseline: Baseline,
): { issues: Issue[]; comparison: BaselineComparison } {
  const accepted = new Set(baseline.issues.map((entry) => entry.fingerprint));
  const marked = issues.map((issue) => ({ ...issue, inBaseline: accepted.has(issue.fingerprint) }));
  const found = new Set(issues.map((issue) => issue.fingerprint));
  const scanned = new Set(screens.map((screen) => screen.name));
  const fixedIssues = baseline.issues.filter((entry) => scanned.has(entry.screen) && !found.has(entry.fingerprint));
  const known = marked.filter((issue) => issue.inBaseline).length;
  return {
    issues: marked,
    comparison: { newIssues: marked.length - known, known, fixed: fixedIssues.length, fixedIssues },
  };
}

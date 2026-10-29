import type { Raster } from './color.js';
import { issueFingerprint } from './fingerprint.js';
import type { DeviceInfo, Issue, PamScreen, ScanSummary, Severity } from './model.js';
import { defaultRules } from './rules/index.js';
import type { Rule } from './rules/index.js';

export interface AnalyzeInput {
  device: DeviceInfo;
  screens: PamScreen[];
  /** Screenshot pixels by screen id. Rules that need pixels skip screens without them. */
  rasters: ReadonlyMap<string, Raster>;
  rules?: readonly Rule[];
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * Runs every rule on every screen. Issues come back in reading order (top to
 * bottom, then left to right) so callout numbers on the screenshot read naturally,
 * and in a deterministic order so golden tests stay stable.
 */
export function analyze(input: AnalyzeInput): Issue[] {
  const rules = input.rules ?? defaultRules;
  const issues: Issue[] = [];
  for (const screen of input.screens) {
    const screenIssues: Issue[] = [];
    for (const rule of rules) {
      const findings = rule.check({ screen, device: input.device, raster: input.rasters.get(screen.id) ?? null });
      for (const finding of findings) {
        screenIssues.push({
          ruleId: rule.meta.id,
          title: rule.meta.title,
          severity: finding.severity ?? rule.meta.severity,
          confidence: finding.confidence ?? rule.meta.confidence,
          screenId: screen.id,
          nodeId: finding.node.id,
          resourceId: finding.node.resourceId,
          fingerprint: issueFingerprint(rule.meta.id, screen.appId, screen.name, finding.node),
          message: finding.message,
          whoIsAffected: rule.meta.whoIsAffected,
          whatTheyExperience: rule.meta.whatTheyExperience,
          wcag: rule.meta.wcag,
          en301549: rule.meta.en301549,
          boundsPx: finding.node.boundsPx,
          evidence: finding.evidence,
          fix: rule.meta.fix,
        });
      }
    }
    screenIssues.sort(
      (a, b) =>
        a.boundsPx.top - b.boundsPx.top ||
        a.boundsPx.left - b.boundsPx.left ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.ruleId.localeCompare(b.ruleId),
    );
    issues.push(...screenIssues);
  }
  return issues;
}

export function summarize(issues: readonly Issue[], rules: readonly Rule[] = defaultRules, ignored = 0): ScanSummary {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    infos: issues.filter((issue) => issue.severity === 'info').length,
    ignored,
    rulesRun: rules.map((rule) => rule.meta.id),
  };
}

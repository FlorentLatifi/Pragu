// SARIF 2.1.0 for GitHub code scanning (ADR-014). A pure mapping from a scan result; where
// each issue points in the repository is decided by the caller (`locate`), because only the
// CLI can look at the project's files.

import type { Confidence, Issue, ScanResult, Severity } from './model.js';
import { defaultRules } from './rules/index.js';
import type { Rule } from './rules/index.js';

/** A place in the repository: GitHub shows a code-scanning alert only with one. */
export interface SarifPlace {
  uri: string;
  line: number;
}

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { error: 'error', warning: 'warning', info: 'note' };
// GitHub's precision scale for rules.
const PRECISION: Record<Confidence, string> = { high: 'high', medium: 'medium', low: 'low' };

function fixesText(rule: Rule): string {
  const { fix } = rule.meta;
  return `React Native: ${fix.reactNative}\nJetpack Compose: ${fix.compose}\nAndroid Views: ${fix.androidViews}`;
}

function descriptor(rule: Rule) {
  const { meta } = rule;
  return {
    id: meta.id,
    name: meta.title,
    shortDescription: { text: meta.title },
    fullDescription: { text: `${meta.whoIsAffected} ${meta.whatTheyExperience}` },
    help: {
      text: fixesText(rule),
      markdown: `**Who it affects:** ${meta.whoIsAffected}\n\n**What they experience:** ${meta.whatTheyExperience}\n\n**How to fix it**\n\n- React Native: ${meta.fix.reactNative}\n- Jetpack Compose: ${meta.fix.compose}\n- Android Views: ${meta.fix.androidViews}`,
    },
    defaultConfiguration: { level: LEVEL[meta.severity] },
    properties: {
      precision: PRECISION[meta.confidence],
      tags: ['accessibility', ...meta.wcag.map((criterion) => `wcag-${criterion}`)].slice(0, 10),
    },
  };
}

/** The result's location: `locate` names the file and line; the region is that line's start. */
function location(place: SarifPlace, issue: Issue, screenName: string) {
  return {
    physicalLocation: {
      artifactLocation: { uri: place.uri },
      region: { startLine: place.line, startColumn: 1, endLine: place.line, endColumn: 1 },
    },
    message: { text: `${screenName}${issue.resourceId === null ? '' : ` › ${issue.resourceId}`}` },
  };
}

/**
 * Converts a scan result to a SARIF 2.1.0 log. Deterministic: rules in their run order,
 * results in the result's order (reading order per screen), so the same scan gives the same file.
 */
export function toSarif(
  result: ScanResult,
  locate: (issue: Issue) => SarifPlace,
  allRules: readonly Rule[] = defaultRules,
): Record<string, unknown> {
  const rules = result.summary.rulesRun.flatMap((id) => allRules.filter((rule) => rule.meta.id === id));
  const index = new Map(rules.map((rule, position) => [rule.meta.id, position]));
  const screenNames = new Map(result.screens.map((screen) => [screen.id, screen.name]));
  const compared = result.summary.baseline !== null;
  const results = result.issues.map((issue) => ({
    ruleId: issue.ruleId,
    ...(index.has(issue.ruleId) ? { ruleIndex: index.get(issue.ruleId) } : {}),
    level: LEVEL[issue.severity],
    message: { text: issue.message },
    locations: [location(locate(issue), issue, screenNames.get(issue.screenId) ?? issue.screenId)],
    partialFingerprints: { 'pragu/v1': issue.fingerprint },
    ...(compared ? { baselineState: issue.inBaseline ? 'unchanged' : 'new' } : {}),
    properties: {
      screen: screenNames.get(issue.screenId) ?? issue.screenId,
      element: issue.resourceId,
      confidence: issue.confidence,
      wcag: issue.wcag,
      en301549: issue.en301549,
      evidence: issue.evidence,
    },
  }));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Pragu',
            version: result.tool.version,
            semanticVersion: result.tool.version,
            informationUri: 'https://github.com/FlorentLatifi/Pragu',
            rules: rules.map(descriptor),
          },
        },
        results,
        properties: { app: result.app.id, redacted: result.redacted, score: result.score.value },
      },
    ],
  };
}

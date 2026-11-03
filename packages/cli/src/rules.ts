import { parseArgs } from 'node:util';
import { defaultRules } from '@pragu/core';
import type { Rule } from '@pragu/core';
import { EXIT, PraguError } from './errors.js';
import type { Io } from './main.js';

const FIX_LABELS: readonly (readonly [keyof Rule['meta']['fix'], string])[] = [
  ['reactNative', 'React Native'],
  ['compose', 'Jetpack Compose'],
  ['androidViews', 'Android Views'],
];

function listRules(rules: readonly Rule[]): string {
  const idWidth = Math.max(...rules.map((rule) => rule.meta.id.length));
  const titleWidth = Math.max(...rules.map((rule) => rule.meta.title.length));
  const lines = rules.map(
    ({ meta }) =>
      `  ${meta.id.padEnd(idWidth)}  ${meta.severity.padEnd(7)}  ${meta.title.padEnd(titleWidth)}  ${meta.wcag.length === 0 ? 'best practice' : `WCAG ${meta.wcag.join(', ')}`}`,
  );
  return [
    `${String(rules.length)} rules. Errors fail a scan by default (--fail-on error); warnings and info do not.`,
    '',
    ...lines,
    '',
    'Explain one: pragu rules --explain <id>',
    '',
  ].join('\n');
}

function explainRule(rule: Rule): string {
  const { meta } = rule;
  const standards = [
    meta.wcag.length === 0 ? 'Best practice (no WCAG criterion)' : `WCAG 2.2: ${meta.wcag.join(', ')}`,
  ];
  if (meta.en301549.length > 0) standards.push(`EN 301 549: ${meta.en301549.join(', ')}`);
  const fixes = FIX_LABELS.filter(([toolkit]) => meta.fix[toolkit].trim() !== '').map(
    ([toolkit, label]) => `Fix in ${label}: ${meta.fix[toolkit]}`,
  );
  return [
    `${meta.id}: ${meta.title}`,
    `Severity: ${meta.severity} (confidence ${meta.confidence})`,
    standards.join(' · '),
    `Who it affects: ${meta.whoIsAffected}`,
    `What they experience: ${meta.whatTheyExperience}`,
    ...fixes,
    '',
  ].join('\n');
}

/** pragu rules [--explain <id>]: what Pragu checks, from the same metadata the reports use. */
export function runRules(args: string[], io: Io, rules: readonly Rule[] = defaultRules): number {
  let explain: string | undefined;
  try {
    explain = parseArgs({ args, strict: true, options: { explain: { type: 'string' } } }).values.explain;
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      'Use "pragu rules" or "pragu rules --explain <id>".',
    );
  }
  if (explain === undefined) {
    io.out(listRules(rules));
    return EXIT.ok;
  }
  const rule = rules.find((candidate) => candidate.meta.id === explain);
  if (rule === undefined) {
    throw new PraguError(
      EXIT.usage,
      `There is no rule "${explain}".`,
      `Known rules: ${rules.map((candidate) => candidate.meta.id).join(', ')}.`,
    );
  }
  io.out(explainRule(rule));
  return EXIT.ok;
}

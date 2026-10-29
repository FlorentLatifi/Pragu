// pragu.config.ts: what a project tells Pragu about itself. Kept to what Pragu can act on
// today; the crawl denylist and login script arrive with the crawler (M3).

import type { Issue, Severity } from './model.js';
import { defaultRules } from './rules/index.js';
import type { Rule } from './rules/index.js';

export type FailOn = Severity | 'never';

/**
 * An issue the project has decided to live with. Every field given must match; a reason
 * is required so the decision stays visible, and the report counts what was ignored.
 */
export interface IgnoreEntry {
  rule?: string;
  resourceId?: string;
  /** Screen name, as given with --screen-name or the window title. */
  screen?: string;
  reason: string;
}

export interface PraguConfig {
  /** Android applicationId to scan. */
  app?: string;
  /** Where to write the report and result (default: pragu-report). */
  out?: string;
  /** Exit 1 on issues at this severity or worse (default: error). */
  failOn?: FailOn;
  /** Also capture at 200% text (text/scaling-truncation); changes, then restores, the device's font scale. */
  checkFontScale?: boolean;
  /** Accepted issues; only issues not in it fail the build. */
  baseline?: string;
  /** Turn a rule off, or change its severity. */
  rules?: Record<string, Severity | 'off'>;
  ignore?: IgnoreEntry[];
}

/** Gives a config file type checking and completion; returns the config unchanged. */
export function defineConfig(config: PraguConfig): PraguConfig {
  return config;
}

const SEVERITIES: readonly string[] = ['error', 'warning', 'info'];
const FAIL_ON: readonly string[] = [...SEVERITIES, 'never'];
const KEYS: readonly string[] = ['app', 'out', 'failOn', 'checkFontScale', 'baseline', 'rules', 'ignore'];

function fail(source: string, problem: string): never {
  throw new Error(`${source}: ${problem}`);
}

function optionalString(value: unknown, source: string, key: string): void {
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    fail(source, `"${key}" must be a non-empty string.`);
  }
}

function checkRules(value: unknown, source: string, ruleIds: readonly string[]): void {
  if (value === undefined) return;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(source, '"rules" must be an object.');
  for (const [id, setting] of Object.entries(value)) {
    if (!ruleIds.includes(id))
      fail(source, `"rules" names an unknown rule "${id}". Known rules: ${ruleIds.join(', ')}.`);
    if (typeof setting !== 'string' || ![...SEVERITIES, 'off'].includes(setting)) {
      fail(source, `"rules.${id}" must be "off", "error", "warning" or "info".`);
    }
  }
}

function checkIgnore(value: unknown, source: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) fail(source, '"ignore" must be an array.');
  value.forEach((entry: unknown, index) => {
    const path = `ignore[${String(index)}]`;
    if (typeof entry !== 'object' || entry === null) fail(source, `${path} must be an object.`);
    const { rule, resourceId, screen, reason } = entry as Record<string, unknown>;
    for (const [key, field] of Object.entries({ rule, resourceId, screen }))
      optionalString(field, source, `${path}.${key}`);
    if (rule === undefined && resourceId === undefined && screen === undefined) {
      fail(
        source,
        `${path} must name a rule, a resourceId or a screen; an entry matching everything would hide every issue.`,
      );
    }
    if (typeof reason !== 'string' || reason.trim() === '') {
      fail(source, `${path} needs a "reason", so the decision to ignore stays visible.`);
    }
  });
}

/** Validates an untrusted config object; errors name the file and the field. */
export function parseConfig(value: unknown, source: string, rules: readonly Rule[] = defaultRules): PraguConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(
      source,
      'the default export must be a config object, e.g. export default defineConfig({ app: "com.example.shop" }).',
    );
  }
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (!KEYS.includes(key)) fail(source, `unknown setting "${key}". Known settings: ${KEYS.join(', ')}.`);
  }
  optionalString(config.app, source, 'app');
  optionalString(config.out, source, 'out');
  optionalString(config.baseline, source, 'baseline');
  if (config.failOn !== undefined && !FAIL_ON.includes(config.failOn as string)) {
    fail(source, `"failOn" must be one of ${FAIL_ON.join(', ')}.`);
  }
  if (config.checkFontScale !== undefined && typeof config.checkFontScale !== 'boolean') {
    fail(source, '"checkFontScale" must be true or false.');
  }
  checkRules(
    config.rules,
    source,
    rules.map((rule) => rule.meta.id),
  );
  checkIgnore(config.ignore, source);
  return config;
}

/** The rules a scan runs: every default rule the config does not turn off. */
export function enabledRules(config: PraguConfig, rules: readonly Rule[] = defaultRules): Rule[] {
  return rules.filter((rule) => config.rules?.[rule.meta.id] !== 'off');
}

function matches(issue: Issue, entry: IgnoreEntry, screenNames: ReadonlyMap<string, string>): boolean {
  return (
    (entry.rule === undefined || entry.rule === issue.ruleId) &&
    (entry.resourceId === undefined || entry.resourceId === issue.resourceId) &&
    (entry.screen === undefined || entry.screen === screenNames.get(issue.screenId))
  );
}

/** Applies severity overrides, then sets aside the issues the project chose to ignore. */
export function applyConfig(
  issues: readonly Issue[],
  config: PraguConfig,
  screenNames: ReadonlyMap<string, string>,
): { issues: Issue[]; ignored: Issue[] } {
  const kept: Issue[] = [];
  const ignored: Issue[] = [];
  for (const issue of issues) {
    const setting = config.rules?.[issue.ruleId];
    const configured = setting === undefined || setting === 'off' ? issue : { ...issue, severity: setting };
    if (config.ignore?.some((entry) => matches(configured, entry, screenNames)) === true) ignored.push(configured);
    else kept.push(configured);
  }
  return { issues: kept, ignored };
}

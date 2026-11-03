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
  /** Screen name: from `screens`, from --screen-name, or the window title. */
  screen?: string;
  reason: string;
}

/** A screen a scan opens and checks. Its name is the key that baselines and ignores match on. */
export interface ScreenConfig {
  /** Shown in the report, e.g. "Cart". Keep it stable: baselines tell screens apart by name. */
  name: string;
  /** Opened on a fresh app start, e.g. "shop://cart". Without one, the app's launch screen. */
  deepLink?: string;
  /** A React Native testID or resource id that is on the screen once it has loaded; the scan waits for it. */
  waitFor?: string;
}

export interface PraguConfig {
  /** Android applicationId to scan. */
  app?: string;
  /** Screens to check, each opened on a fresh app start. Without them, the screen on show after launch. */
  screens?: ScreenConfig[];
  /** Where to write the report and result (default: pragu-report). */
  out?: string;
  /** Exit 1 on issues at this severity or worse (default: error). */
  failOn?: FailOn;
  /** Also capture at 200% text (text/scaling-truncation); changes, then restores, the device's font scale. */
  checkFontScale?: boolean;
  /** Accepted issues; only issues not in it fail the build. */
  baseline?: string;
  /** Write reports for sharing: the app's text covered and replaced, no raw captures (--redact). */
  redact?: boolean;
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
const KEYS: readonly string[] = [
  'app',
  'screens',
  'out',
  'failOn',
  'checkFontScale',
  'baseline',
  'redact',
  'rules',
  'ignore',
];
const SCREEN_KEYS: readonly string[] = ['name', 'deepLink', 'waitFor'];
// The deep link travels through the device's shell inside single quotes, so quotes and spaces are refused.
const DEEP_LINK = /^[a-z][a-z0-9+.-]*:[^\s'"]+$/i;

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

function checkScreen(entry: unknown, path: string, source: string, names: Set<string>): void {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) fail(source, `${path} must be an object.`);
  const screen = entry as Record<string, unknown>;
  for (const key of Object.keys(screen)) {
    if (!SCREEN_KEYS.includes(key)) {
      fail(source, `${path} has an unknown setting "${key}". Known settings: ${SCREEN_KEYS.join(', ')}.`);
    }
  }
  if (typeof screen.name !== 'string' || screen.name.trim() === '') {
    fail(source, `${path} needs a "name", e.g. "Cart": reports, baselines and ignores use it.`);
  }
  if (names.has(screen.name)) {
    fail(source, `${path}: the name "${screen.name}" is used twice. Baselines tell screens apart by name.`);
  }
  names.add(screen.name);
  if (screen.deepLink !== undefined && (typeof screen.deepLink !== 'string' || !DEEP_LINK.test(screen.deepLink))) {
    fail(source, `${path}.deepLink must be a URL with a scheme and no spaces or quotes, e.g. "shop://cart".`);
  }
  optionalString(screen.waitFor, source, `${path}.waitFor`);
}

function checkScreens(value: unknown, source: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0) {
    fail(source, '"screens" must be a non-empty array, e.g. [{ name: "Cart", deepLink: "shop://cart" }].');
  }
  const names = new Set<string>();
  value.forEach((entry: unknown, index) => {
    checkScreen(entry, `screens[${String(index)}]`, source, names);
  });
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
  checkScreens(config.screens, source);
  optionalString(config.out, source, 'out');
  optionalString(config.baseline, source, 'baseline');
  if (config.failOn !== undefined && !FAIL_ON.includes(config.failOn as string)) {
    fail(source, `"failOn" must be one of ${FAIL_ON.join(', ')}.`);
  }
  for (const key of ['checkFontScale', 'redact'] as const) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean') fail(source, `"${key}" must be true or false.`);
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

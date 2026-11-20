import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { comparableScores, transcript } from '@pragu/core';
import type { Issue, SarifPlace, ScanResult } from '@pragu/core';
import { readResult } from './baseline.js';
import { makeIdLocator } from './locate.js';
import { EXIT, PraguError } from './errors.js';
import type { Io } from './main.js';

/** Finds Pragu's own comment on a pull request, so a new push updates it instead of adding another. */
export const COMMENT_MARKER = '<!-- pragu-comment -->';
const MAX_LISTED = 10;
const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', info: 'Info' } as const;

export interface CommentOptions {
  /** The latest scan of the main branch; without it, "new" means "not in the baseline". */
  base: ScanResult | null;
  /** Where the full report is, e.g. the workflow run that uploaded it. */
  reportUrl: string | null;
  /** Where an element id is named in the source (D-43, tier 1); without it no location is shown. */
  locate?: (id: string) => SarifPlace | null;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** New in this pull request: not in the main branch's scan, or, without one, not accepted by the baseline. */
export function newIssues(head: ScanResult, base: ScanResult | null): Issue[] {
  if (base === null) return head.issues.filter((issue) => !issue.inBaseline);
  const known = new Set(base.issues.map((issue) => issue.fingerprint));
  return head.issues.filter((issue) => !known.has(issue.fingerprint));
}

/** What a screen reader says at the element, from Pragu's transcript; null when it never stops there. */
function spoken(result: ScanResult, issue: Issue): string | null {
  const screen = result.screens.find((candidate) => candidate.id === issue.screenId);
  if (screen === undefined) return null;
  return transcript(screen).find((line) => line.nodeId === issue.nodeId)?.text ?? null;
}

// Markdown would read * _ ` [ ] < > | in the app's text as formatting.
function inline(text: string): string {
  return text.replace(/[\\`*_[\]<>|]/g, (character) => `\\${character}`);
}

// Ids and file paths come from the app and the repository: inside a code span nothing is
// formatting, except a backtick or a line break, which are dropped.
const UNSAFE_IN_CODE = /[\p{Cc}\p{Zl}\p{Zp}`]/gu;

function code(text: string): string {
  const clean = text.replace(UNSAFE_IN_CODE, '');
  return '`' + clean + '`';
}

function renderIssue(result: ScanResult, issue: Issue, locate: CommentOptions['locate']): string {
  const screen = result.screens.find((candidate) => candidate.id === issue.screenId)?.name ?? issue.screenId;
  const element = issue.resourceId === null ? '' : ` › ${code(issue.resourceId)}`;
  const said = spoken(result, issue);
  const lines = [`- ${inline(screen)}${element}: ${inline(issue.message)}`];
  if (said !== null) lines.push(`  Screen reader says: "${inline(said)}"`);
  const place = issue.resourceId === null ? null : (locate?.(issue.resourceId) ?? null);
  if (place !== null) lines.push(`  Likely here: ${code(`${place.uri}:${String(place.line)}`)}`);
  return lines.join('\n');
}

function renderFix(issue: Issue): string | null {
  const fixes = [
    ['React Native', issue.fix.reactNative],
    ['Jetpack Compose', issue.fix.compose],
    ['Android Views', issue.fix.androidViews],
  ].filter(([, fix]) => fix !== undefined && fix.trim() !== '');
  if (fixes.length === 0) return null;
  return `<details><summary>How to fix</summary>\n\n${fixes.map(([toolkit, fix]) => `- ${toolkit ?? ''}: ${inline(fix ?? '')}`).join('\n')}\n\n</details>`;
}

/** Issues of one rule, in the order the rule first appears. */
function byRule(issues: Issue[]): Issue[][] {
  const groups = new Map<string, Issue[]>();
  for (const issue of issues) {
    const group = groups.get(issue.ruleId);
    if (group === undefined) groups.set(issue.ruleId, [issue]);
    else group.push(issue);
  }
  return [...groups.values()];
}

// The fix comes from the rule's metadata, so it is the same for every issue of a rule: shown once.
function renderRule(result: ScanResult, issues: Issue[], locate: CommentOptions['locate']): string {
  const [first] = issues;
  if (first === undefined) return '';
  const wcag = first.wcag.length === 0 ? 'best practice' : `WCAG ${first.wcag.join(', ')}`;
  const header = `**${inline(first.title)}** · ${SEVERITY_LABEL[first.severity]} · ${wcag} · ${String(issues.length)} new`;
  const fix = renderFix(first);
  const parts = [header, issues.map((issue) => renderIssue(result, issue, locate)).join('\n')];
  if (fix !== null) parts.push(fix);
  return parts.join('\n\n');
}

/**
 * The pull-request comment (ADR-014): short, only what this pull request adds, details
 * folded away, and a pointer to the full report. The same text goes to the job summary.
 */
export function renderComment(head: ScanResult, options: CommentOptions): string {
  const added = newIssues(head, options.base);
  const known = head.issues.length - added.length;
  const title =
    added.length === 0
      ? '### Pragu · no new barriers in this pull request'
      : `### Pragu · ${plural(added.length, 'new barrier', 'new barriers')} in this pull request`;
  const listed = byRule(added.slice(0, MAX_LISTED)).map((issues) => renderRule(head, issues, options.locate));
  const more = added.length > MAX_LISTED ? [`…and ${String(added.length - MAX_LISTED)} more in the report.`] : [];
  const body = [...listed, ...more].join('\n\n');
  const compared = options.base === null ? 'the baseline' : 'the latest scan of the main branch';
  const score =
    head.score.value === null
      ? null
      : options.base !== null && comparableScores(head, options.base)
        ? `Pragu score ${String(options.base.score.value)} → ${String(head.score.value)}`
        : `Pragu score ${String(head.score.value)}/100`;
  const footer = [
    score,
    `${plural(head.screens.length, 'screen', 'screens')} checked · ${plural(known, 'known issue', 'known issues')} not listed (compared with ${compared})`,
    options.reportUrl === null ? null : `Full report: [pragu-report](${options.reportUrl})`,
    'Automated checks find some barriers, not all; test with TalkBack too.',
  ].filter((line): line is string => line !== null);
  return [COMMENT_MARKER, title, '', ...(body === '' ? [] : [body]), '', footer.join(' · '), ''].join('\n');
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** pragu comment <pragu-result.json> [--base <main result>] [--report-url <url>] [--source-root <dir>] [--out <file>] */
export async function runComment(args: string[], io: Io): Promise<number> {
  let parsed: {
    positionals: string[];
    values: { base?: string; 'report-url'?: string; 'source-root'?: string; out?: string };
  };
  try {
    parsed = parseArgs({
      args,
      strict: true,
      allowPositionals: true,
      options: {
        base: { type: 'string' },
        'report-url': { type: 'string' },
        'source-root': { type: 'string' },
        out: { type: 'string' },
      },
    });
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      'Use "pragu comment pragu-report/pragu-result.json [--base main-result.json]".',
    );
  }
  const [file, ...extra] = parsed.positionals;
  if (file === undefined || extra.length > 0) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which scan result to describe.',
      'Use "pragu comment pragu-report/pragu-result.json".',
    );
  }
  const { base: baseFile } = parsed.values;
  // A first run has no main-branch scan yet; the baseline comparison is the fallback, not an error.
  const base = baseFile !== undefined && existsSync(baseFile) ? await readResult(baseFile) : null;
  const root = parsed.values['source-root'] ?? process.cwd();
  if (!isDirectory(root)) {
    throw new PraguError(
      EXIT.usage,
      `The source folder ${root} does not exist or is not a folder.`,
      'Pass an existing folder to --source-root.',
    );
  }
  const markdown = renderComment(await readResult(file), {
    base,
    reportUrl: parsed.values['report-url'] ?? null,
    locate: makeIdLocator(root),
  });
  if (parsed.values.out === undefined) io.out(markdown);
  else await writeFile(parsed.values.out, markdown);
  return EXIT.ok;
}

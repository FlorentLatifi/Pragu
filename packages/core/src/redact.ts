// --redact: a result meant for sharing, e.g. as a CI artifact of a public repository. Text
// from the scanned app can be personal (test accounts, balances, addresses), and it appears
// in names, texts, hints, window titles, screen names taken from a title, messages and
// evidence. All of it is replaced; what a developer needs to find and fix the barrier stays:
// rule, element id, role, bounds, measurements, fingerprint (D-33).

import type { Raster } from './color.js';
import type { FixedIssue, Issue, PamNode, PamScreen, ScanResult } from './model.js';

export const REDACTED = '[redacted]';

// Words Pragu itself puts in quotes: what a screen reader announces for a role, in either case
// ("Button" in a missing-name message, "button" in a role-in-label one). Compared in lower case.
const OWN_WORDS = new Set([
  'button',
  'edit box',
  'image',
  'checkbox',
  'check box',
  'switch',
  'toggle',
  'radio button',
  'link',
  'tab',
  'slider',
]);
// Evidence that describes the element or a measurement, never the app's text.
const SAFE_EVIDENCE = new Set(['role', 'platformRole', 'foreground', 'background', 'textSizeDp']);

function hide(value: string | null): string | null {
  return value === null ? null : REDACTED;
}

function isOwnWord(value: string): boolean {
  return OWN_WORDS.has(value.trim().toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the app's strings wherever a message repeats them, longest first, so app text that
 * contains quotes cannot end a quoted span early. A match must not sit inside a longer word.
 * Null when there is nothing to look for.
 */
function appTextPattern(strings: Iterable<string>): RegExp | null {
  const wanted = [...new Set(strings)].filter((value) => value.trim() !== '' && !isOwnWord(value));
  if (wanted.length === 0) return null;
  const alternatives = wanted.sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
}

/** Replaces quoted app text in a message; quotes of Pragu's own role words stay. */
export function redactMessage(message: string): string {
  return message.replace(/"([^"]*)"/g, (quoted, inner: string) =>
    isOwnWord(inner) || inner === REDACTED ? quoted : `"${REDACTED}"`,
  );
}

/**
 * Replaces every known app string first, so quotes inside app text cannot end a quoted span
 * early; then the quote pass catches text the scan no longer holds (a fixed baseline issue).
 */
function redactAppText(message: string, appText: RegExp | null): string {
  return redactMessage(appText === null ? message : message.replace(appText, REDACTED));
}

function nodeStrings(nodes: readonly PamNode[]): string[] {
  return nodes.flatMap((node) => [node.name, node.text, node.hint].filter((value) => value !== null));
}

/** Every string the screen took from the app, including a screen name that is a window title. */
function screenStrings(screen: PamScreen): string[] {
  const titles = screen.windows.flatMap((window) => (window.title === null ? [] : [window.title]));
  return [...nodeStrings(screen.nodes), ...nodeStrings(screen.largeText?.nodes ?? []), ...titles];
}

function isTitleName(screen: PamScreen): boolean {
  return screen.windows.some((window) => window.title === screen.name);
}

function redactNode(node: PamNode): PamNode {
  // Names stay non-null, so the transcript reads "[redacted], Button" rather than claiming "Unlabelled".
  return { ...node, name: hide(node.name), text: hide(node.text), hint: hide(node.hint) };
}

function redactScreen(screen: PamScreen, name: string): PamScreen {
  const windows = screen.windows.map((window) => ({ ...window, title: hide(window.title) }));
  return {
    ...screen,
    name,
    windows,
    nodes: screen.nodes.map(redactNode),
    largeText:
      screen.largeText === null
        ? null
        : { ...screen.largeText, windows, nodes: screen.largeText.nodes.map(redactNode) },
  };
}

function redactIssue(issue: Issue, appText: RegExp | null): Issue {
  const evidence = Object.fromEntries(
    Object.entries(issue.evidence).map(([key, value]) => [
      key,
      typeof value === 'number' || SAFE_EVIDENCE.has(key) ? value : REDACTED,
    ]),
  );
  return { ...issue, message: redactAppText(issue.message, appText), evidence };
}

/** The same result with the app's text replaced. Run it after analysis: rules need the real text. */
export function redactResult(result: ScanResult): ScanResult {
  // A screen named after its window title (no configured name) is named by its place instead,
  // like a capture with no title. Fingerprints were computed before, so baselines still match.
  const renamed = new Map(
    result.screens.flatMap((screen, index) =>
      isTitleName(screen) ? [[screen.name, `Screen ${String(index + 1)}`]] : [],
    ),
  );
  const appText = appTextPattern([...result.screens.flatMap(screenStrings), ...renamed.keys()]);
  const redactFixed = (entry: FixedIssue): FixedIssue => ({
    ...entry,
    screen: renamed.get(entry.screen) ?? entry.screen,
    message: redactAppText(entry.message, appText),
  });
  const { baseline } = result.summary;
  return {
    ...result,
    redacted: true,
    screens: result.screens.map((screen) => redactScreen(screen, renamed.get(screen.name) ?? screen.name)),
    issues: result.issues.map((issue) => redactIssue(issue, appText)),
    summary: {
      ...result.summary,
      baseline: baseline === null ? null : { ...baseline, fixedIssues: baseline.fixedIssues.map(redactFixed) },
    },
  };
}

const COVER = [0x76, 0x76, 0x76];

/**
 * Paints over every text and hint the app's own windows draw, in the screenshot a shared
 * report embeds, including elements marked not visible: text behind a card-sized dialog still
 * shows in the screenshot (ADR-008). Covering too much is safe; too little leaks. Images are not
 * covered: telling a photo from an icon would be a guess.
 */
export function coverText(raster: Raster, screen: PamScreen): void {
  const appWindows = new Set(screen.windows.flatMap((window, index) => (window.kind === 'app' ? [index] : [])));
  for (const node of screen.nodes) {
    if (!appWindows.has(node.window) || (node.text === null && node.hint === null)) continue;
    const { left, top, right, bottom } = node.boundsPx;
    for (let y = Math.max(0, top); y < Math.min(raster.height, bottom); y++) {
      for (let x = Math.max(0, left); x < Math.min(raster.width, right); x++) {
        raster.data.set(COVER, (y * raster.width + x) * 4);
      }
    }
  }
}

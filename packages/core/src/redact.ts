// --redact: a result meant for sharing, e.g. as a CI artifact of a public repository. Text
// from the scanned app can be personal (test accounts, balances, addresses), and it appears
// in names, texts, hints, window titles, quotes in messages and evidence. All of it is
// replaced; what a developer needs to find and fix the barrier stays: rule, element id,
// role, bounds, measurements, fingerprint (D-33).

import type { Raster } from './color.js';
import type { Issue, PamNode, PamScreen, ScanResult } from './model.js';

export const REDACTED = '[redacted]';

// Words Pragu itself puts in quotes: what a screen reader announces for a role.
const OWN_WORDS = new Set([
  'Button',
  'Edit box',
  'Image',
  'Checkbox',
  'Switch',
  'Radio button',
  'Link',
  'Tab',
  'Slider',
]);
// Evidence that describes the element or a measurement, never the app's text.
const SAFE_EVIDENCE = new Set(['role', 'platformRole', 'foreground', 'background', 'textSizeDp']);

function hide(value: string | null): string | null {
  return value === null ? null : REDACTED;
}

/** Replaces quoted app text in a message; quotes of Pragu's own role words stay. */
export function redactMessage(message: string): string {
  return message.replace(/"([^"]*)"/g, (quoted, inner: string) => (OWN_WORDS.has(inner) ? quoted : `"${REDACTED}"`));
}

function redactNode(node: PamNode): PamNode {
  // Names stay non-null, so the transcript reads "[redacted], Button" rather than claiming "Unlabelled".
  return { ...node, name: hide(node.name), text: hide(node.text), hint: hide(node.hint) };
}

function redactScreen(screen: PamScreen): PamScreen {
  const windows = screen.windows.map((window) => ({ ...window, title: hide(window.title) }));
  return {
    ...screen,
    windows,
    nodes: screen.nodes.map(redactNode),
    largeText:
      screen.largeText === null
        ? null
        : { ...screen.largeText, windows, nodes: screen.largeText.nodes.map(redactNode) },
  };
}

function redactIssue(issue: Issue): Issue {
  const evidence = Object.fromEntries(
    Object.entries(issue.evidence).map(([key, value]) => [
      key,
      typeof value === 'number' || SAFE_EVIDENCE.has(key) ? value : REDACTED,
    ]),
  );
  return { ...issue, message: redactMessage(issue.message), evidence };
}

/** The same result with the app's text replaced. Run it after analysis: rules need the real text. */
export function redactResult(result: ScanResult): ScanResult {
  const { baseline } = result.summary;
  return {
    ...result,
    redacted: true,
    screens: result.screens.map(redactScreen),
    issues: result.issues.map(redactIssue),
    summary: {
      ...result.summary,
      baseline:
        baseline === null
          ? null
          : {
              ...baseline,
              fixedIssues: baseline.fixedIssues.map((entry) => ({ ...entry, message: redactMessage(entry.message) })),
            },
    },
  };
}

const COVER = [0x76, 0x76, 0x76];

/**
 * Paints over every text and hint the app's own windows draw, in the screenshot a shared
 * report embeds. Images are not covered: telling a photo from an icon would be a guess.
 */
export function coverText(raster: Raster, screen: PamScreen): void {
  const appWindows = new Set(screen.windows.flatMap((window, index) => (window.kind === 'app' ? [index] : [])));
  for (const node of screen.nodes) {
    if (!appWindows.has(node.window) || !node.visible || (node.text === null && node.hint === null)) continue;
    const { left, top, right, bottom } = node.boundsPx;
    for (let y = Math.max(0, top); y < Math.min(raster.height, bottom); y++) {
      for (let x = Math.max(0, left); x < Math.min(raster.width, right); x++) {
        raster.data.set(COVER, (y * raster.width + x) * 4);
      }
    }
  }
}

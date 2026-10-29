import type { Issue, PamScreen, ScanResult, Severity } from '@pragu/core';
import { FONT_FACES } from './fonts.js';
import { themeCss } from './theme.js';

export interface ReportScreenshot {
  mimeType: 'image/png' | 'image/webp';
  base64: string;
}

export interface ReportInput {
  result: ScanResult;
  /** Screenshot bytes by screen id, embedded so the report works offline. */
  screenshots: ReadonlyMap<string, ReportScreenshot>;
}

const SEVERITY_LABEL: Record<Severity, string> = { error: 'Error', warning: 'Warning', info: 'Info' };

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function percent(value: number, total: number): string {
  return `${(total === 0 ? 0 : (value / total) * 100).toFixed(3)}%`;
}

/**
 * Renders the report: one self-contained HTML file with no external requests,
 * fonts included. Design direction "Signal" (DESIGN.md): black and yellow plates
 * that carry the measurements on the screenshot itself.
 */
export function renderReport({ result, screenshots }: ReportInput): string {
  const { issues, summary, device, app } = result;
  const headline =
    issues.length === 0
      ? `No barriers found by ${plural(summary.rulesRun.length, 'automated check', 'automated checks')}`
      : `${plural(issues.length, 'barrier', 'barriers')} found in ${app.id}`;
  let number = 0;
  const screens = result.screens
    .map((screen) => {
      const screenIssues = issues.filter((issue) => issue.screenId === screen.id);
      const numbered = screenIssues.map((issue) => ({ issue, number: ++number }));
      return renderScreen(screen, numbered, screenshots.get(screen.id), device.screenWidthPx, device.screenHeightPx);
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(`Pragu report · ${app.id}`)}</title>
<style>${STYLES}</style>
</head>
<body>
<a class="skip" href="#main">Skip to results</a>
<header class="masthead">
  <div class="masthead-row">
    <p class="eyebrow">Pragu · automated accessibility checks</p>
    <button type="button" id="theme-toggle" class="toggle" aria-pressed="false">Dark theme</button>
  </div>
  <div class="sign${issues.length === 0 ? ' sign-clear' : ''}">
    <h1>${escapeHtml(headline)}</h1>
  </div>
  <p class="meta">${escapeHtml(`${device.manufacturer} ${device.model} · Android ${device.osVersion} (API ${String(device.apiLevel)}) · ${String(device.densityDpi)} dpi · font scale ${String(device.fontScale)} · ${result.startedAt}`)}</p>
</header>
<main id="main">
<section class="summary" aria-labelledby="summary-heading">
  <h2 id="summary-heading" class="visually-hidden">Summary</h2>
  <dl class="counts">
    <div><dt>Errors</dt><dd>${String(summary.errors)}</dd></div>
    <div><dt>Warnings</dt><dd>${String(summary.warnings)}</dd></div>
    <div><dt>Info</dt><dd>${String(summary.infos)}</dd></div>
    <div><dt>Screens</dt><dd>${String(result.screens.length)}</dd></div>
  </dl>
  <p class="rules">Rules run: ${summary.rulesRun.map((id) => `<code>${escapeHtml(id)}</code>`).join(', ')}</p>
</section>
${screens}
<section class="limits" aria-labelledby="limits-heading">
  <h2 id="limits-heading">What these checks cannot tell you</h2>
  <p>Automated checks find some barriers, not all, and this report is not a compliance statement. Still check by hand: whether names are meaningful in context, the reading order across the whole screen, behaviour at 200% text size, gestures and timing, and the full journey with TalkBack switched on.</p>
</section>
</main>
<footer class="footer">
  <p>${escapeHtml(`Pragu ${result.tool.version} · result schema ${result.schemaVersion}`)} · Generated on this machine; nothing was uploaded.</p>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

/** What this screen's checks could not see, said plainly next to the results. */
export function screenNotes(screen: PamScreen): string[] {
  const notes: string[] = [];
  if (screen.windows.filter((window) => window.kind === 'app').length > 1) {
    notes.push('A dialog or popup was open, so only its content was checked.');
  }
  if (screen.windows.some((window) => window.kind === 'keyboard')) {
    notes.push('The keyboard was open; elements it covered were not checked.');
  }
  if (screen.nodes.some((node) => node.inWebView)) {
    notes.push(
      'This screen contains web content (a WebView). Pragu checks native UI only; test web content with a web tool such as axe-core.',
    );
  }
  if (screen.largeText !== null) {
    notes.push(
      `Also captured at ${String(Math.round(screen.largeText.fontScale * 100))}% text size, to find text that gets cut off.`,
    );
  }
  return notes;
}

// Signs are laid out in percent of the screenshot, which is shown at most this wide.
const FRAME_WIDTH_PX = 360;
const NUMBER_CHAR_PX = 8;
const MEASURE_CHAR_PX = 6.7;
const SIGN_PADDING_PX = 14;
const SIGN_HEIGHT_PX = 24;
const SIGN_GAP_PX = 4;

interface PlacedSign {
  number: number;
  measure: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
}

function overlaps(a: PlacedSign, b: PlacedSign): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/**
 * Each marker gets one sign with its number and measurement ("1 · no name"), placed
 * just above the marker (below it at the top of the screen). A sign that would cover
 * one already placed steps further away; its number still ties it to its marker.
 */
function placeSigns(
  numbered: readonly { issue: Issue; number: number }[],
  screenWidthPx: number,
  screenHeightPx: number,
): PlacedSign[] {
  const frameHeightPx = (FRAME_WIDTH_PX * screenHeightPx) / screenWidthPx;
  const height = (SIGN_HEIGHT_PX / frameHeightPx) * 100;
  const gap = (SIGN_GAP_PX / frameHeightPx) * 100;
  const placed: PlacedSign[] = [];
  for (const { issue, number } of numbered) {
    const measure = measurement(issue);
    const textPx =
      String(number).length * NUMBER_CHAR_PX + (measure === null ? 0 : measure.length * MEASURE_CHAR_PX + 8);
    const width = ((textPx + SIGN_PADDING_PX) / FRAME_WIDTH_PX) * 100;
    const { left, top, bottom } = issue.boundsPx;
    const below = top / screenHeightPx < 0.05;
    const sign: PlacedSign = {
      number,
      measure,
      width,
      height,
      left: Math.min(Math.max((left / screenWidthPx) * 100, 0), 100 - width),
      top: below ? (bottom / screenHeightPx) * 100 + gap : (top / screenHeightPx) * 100 - gap - height,
    };
    while (placed.some((other) => overlaps(sign, other))) sign.top += below ? height : -height;
    placed.push(sign);
  }
  return placed;
}

function renderScreen(
  screen: PamScreen,
  numbered: { issue: Issue; number: number }[],
  screenshot: ReportScreenshot | undefined,
  screenWidthPx: number,
  screenHeightPx: number,
): string {
  const headingId = `${screen.id}-heading`;
  const markers = numbered
    .map(({ issue, number }) => {
      const { left, top, right, bottom } = issue.boundsPx;
      const style = `left:${percent(left, screenWidthPx)};top:${percent(top, screenHeightPx)};width:${percent(right - left, screenWidthPx)};height:${percent(bottom - top, screenHeightPx)}`;
      return `<a class="marker" href="#issue-${String(number)}" style="${style}" aria-label="${escapeHtml(`Issue ${String(number)}: ${issue.title}`)}"></a>`;
    })
    .join('');
  const placed = placeSigns(numbered, screenWidthPx, screenHeightPx);
  // Signs stacked above the top of the screenshot need room; a percentage margin is
  // measured against the frame's width, so convert from the screenshot's height.
  const overhang = Math.max(0, ...placed.map((sign) => -sign.top)) * (screenHeightPx / screenWidthPx);
  const frameStyle = overhang > 0 ? ` style="margin-top:max(32px, calc(${overhang.toFixed(3)}% + 8px))"` : '';
  const signs = placed
    .map((sign) => {
      const measure = sign.measure === null ? '' : `<span class="sign-measure">${escapeHtml(sign.measure)}</span>`;
      return `<span class="screen-sign" style="left:${sign.left.toFixed(3)}%;top:${sign.top.toFixed(3)}%" aria-hidden="true"><span class="sign-number">${String(sign.number)}</span>${measure}</span>`;
    })
    .join('');
  const figure =
    screenshot === undefined
      ? '<p class="no-shot">No screenshot was captured for this screen.</p>'
      : `<figure class="shot">
      <div class="shot-frame"${frameStyle}>
        <img src="data:${screenshot.mimeType};base64,${screenshot.base64}" alt="${escapeHtml(`Screenshot of the ${screen.name} screen, with ${plural(numbered.length, 'numbered marker', 'numbered markers')}.`)}">
        ${markers}${signs}
      </div>
      <figcaption>Numbers on the screenshot match the list.</figcaption>
    </figure>`;
  const list =
    numbered.length === 0
      ? '<p class="empty">Nothing found on this screen by these checks. That is a good start, not proof of accessibility: try it with TalkBack next.</p>'
      : `<ol class="issues">${numbered.map(({ issue, number }) => renderIssue(issue, number)).join('\n')}</ol>`;
  const notes = screenNotes(screen);
  const notesList =
    notes.length === 0 ? '' : `<ul class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`;
  return `<section class="screen" aria-labelledby="${headingId}">
  <h2 id="${headingId}">${escapeHtml(screen.name)} <span class="screen-app">${escapeHtml(screen.appId)}</span></h2>
  ${notesList}
  <div class="screen-grid">
    ${figure}
    ${list}
  </div>
</section>`;
}

const FIX_TOOLKITS: readonly (readonly [keyof Issue['fix'], string])[] = [
  ['reactNative', 'React Native'],
  ['compose', 'Jetpack Compose'],
  ['androidViews', 'Android Views'],
];

// Pragu does not yet tell which toolkit built the app, so every fix is shown.
function renderFixes(issue: Issue): string {
  return FIX_TOOLKITS.filter(([toolkit]) => issue.fix[toolkit].trim() !== '')
    .map(([toolkit, label]) => `    <dt>Fix in ${label}</dt><dd>${escapeHtml(issue.fix[toolkit])}</dd>`)
    .join('\n');
}

/**
 * The short measurement printed on the screenshot next to each marker, like a
 * dimension on a drawing. Null when a rule has nothing to measure.
 */
export function measurement(issue: Issue): string | null {
  const { evidence } = issue;
  switch (issue.ruleId) {
    case 'target/size':
      return typeof evidence.widthDp === 'number' && typeof evidence.heightDp === 'number'
        ? `${String(evidence.widthDp)} × ${String(evidence.heightDp)} dp`
        : null;
    case 'contrast/text':
      return typeof evidence.ratio === 'number' ? `${String(evidence.ratio)} : 1` : null;
    case 'text/scaling-truncation':
      return 'cut at 200%';
    case 'name/interactive-missing':
    case 'name/image-missing':
      return 'no name';
    case 'input/missing-label':
      return 'no label';
    case 'state/not-exposed':
      return 'no state';
    case 'focus/unreachable':
      return 'hidden';
    default:
      return null;
  }
}

function renderIssue(issue: Issue, number: number): string {
  const evidence = Object.entries(issue.evidence)
    .map(([key, value]) => `<code>${escapeHtml(key)}: ${escapeHtml(String(value))}</code>`)
    .join(' ');
  const standards = [
    ...issue.wcag.map((sc) => `WCAG ${sc}`),
    ...issue.en301549.map((clause) => `EN 301 549 ${clause}`),
  ];
  const element = issue.resourceId === null ? '' : `Element <code>${escapeHtml(issue.resourceId)}</code> · `;
  return `<li class="issue" id="issue-${String(number)}" tabindex="-1">
  <h3><span class="plate" aria-hidden="true">${String(number)}</span>${escapeHtml(issue.title)}</h3>
  <p class="tags"><span class="severity severity-${issue.severity}">${SEVERITY_LABEL[issue.severity]}</span>${standards.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}<span>Confidence: ${issue.confidence}</span></p>
  <p class="message">${escapeHtml(issue.message)}</p>
  <dl class="details">
    <dt>Who it affects</dt><dd>${escapeHtml(issue.whoIsAffected)}</dd>
    <dt>What they experience</dt><dd>${escapeHtml(issue.whatTheyExperience)}</dd>
    <dt>Evidence</dt><dd>${evidence}</dd>
${renderFixes(issue)}
  </dl>
  <p class="where">${element}Rule <code>${escapeHtml(issue.ruleId)}</code></p>
</li>`;
}

// Theme toggle. Storage can be blocked (private windows, file:// policies), so the page works without it.
const SCRIPT = `(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  try { var saved = localStorage.getItem('pragu-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : media.matches; }
  function sync() { button.setAttribute('aria-pressed', String(isDark())); }
  button.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pragu-theme', next); } catch (e) {}
    sync();
  });
  media.addEventListener('change', sync);
  sync();
})();`;

// Direction "Signal" (DESIGN.md). Tokens come from theme.ts; this sheet only uses the variables.
const STYLES = `${FONT_FACES}
${themeCss()}
:root {
  --font-text: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-mono: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 var(--font-text); }
a { color: inherit; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
code { font: 0.875em var(--font-mono); }
.skip { position: absolute; left: 16px; top: -64px; padding: 12px 16px; background: var(--signal); color: var(--on-signal); font-weight: 700; }
.skip:focus { top: 16px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.masthead, main, .footer { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
.masthead { padding-top: 24px; padding-bottom: 24px; }
.masthead-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.eyebrow { margin: 0; font: 700 12px/1.4 var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.sign { margin: 24px -16px 12px; padding: 24px 16px; background: var(--signal); color: var(--on-signal); border-top: 4px solid var(--halo); border-bottom: 4px solid var(--halo); }
.sign-clear { background: var(--surface); color: var(--ink); border-color: var(--ink); }
h1 { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 700; max-width: 24ch; overflow-wrap: anywhere; }
@media (min-width: 720px) { h1 { font-size: 40px; } .sign { margin-left: 0; margin-right: 0; padding: 32px 24px; } }
h2 { font-size: 20px; line-height: 1.3; margin: 0 0 16px; font-weight: 700; }
h3 { font-size: 16px; line-height: 1.4; margin: 0; display: flex; gap: 12px; align-items: center; font-weight: 700; }
.meta, .rules, .where, figcaption { color: var(--muted); font-size: 14px; margin: 0; }
.meta { font-family: var(--font-mono); font-size: 12px; }
.toggle { min-height: 44px; padding: 0 16px; border: 2px solid var(--ink); border-radius: 6px; background: var(--bg); color: var(--ink); font: 700 14px var(--font-text); white-space: nowrap; cursor: pointer; }
.summary { padding: 8px 0 24px; border-bottom: 1px solid var(--line); }
.counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin: 0 0 12px; }
.counts div { border-left: 4px solid var(--ink); padding-left: 12px; }
.counts dt { font: 700 12px/1.4 var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.counts dd { margin: 0; font: 700 40px/1.1 var(--font-mono); }
.screen { padding: 32px 0; border-bottom: 1px solid var(--line); }
.screen-app { font: 400 14px var(--font-mono); color: var(--muted); margin-left: 8px; overflow-wrap: anywhere; }
.notes { margin: -4px 0 24px; padding: 8px 0 8px 16px; list-style: none; border-left: 4px solid var(--ink); font-size: 14px; }
.notes li + li { margin-top: 4px; }
.screen-grid { display: grid; gap: 32px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) { .screen-grid { grid-template-columns: 360px minmax(0, 1fr); align-items: start; } .shot { position: sticky; top: 16px; } }
.shot { margin: 0; max-width: 360px; }
.shot-frame { position: relative; background: var(--surface); line-height: normal; margin-top: 32px; }
.shot-frame img { line-height: 0; }
.shot-frame img { width: 100%; height: auto; display: block; }
figcaption { margin-top: 12px; }
.plate { flex: none; display: inline-block; min-width: 24px; height: 24px; padding: 0 4px; background: var(--signal); color: var(--on-signal); border: 2px solid var(--halo); font: 700 13px/20px var(--font-mono); text-align: center; }
.marker { position: absolute; border: 3px solid var(--signal); box-shadow: 0 0 0 2px var(--halo), inset 0 0 0 1px var(--halo); text-decoration: none; }
.screen-sign { position: absolute; display: flex; align-items: stretch; height: 24px; background: var(--signal); color: var(--on-signal); border: 2px solid var(--halo); white-space: nowrap; pointer-events: none; z-index: 1; }
.sign-number { padding: 0 5px; font: 700 13px/20px var(--font-mono); }
.sign-measure { padding: 0 5px; border-left: 2px solid var(--halo); font: 700 11px/20px var(--font-mono); }
.marker:focus-visible { outline-offset: 4px; }
.no-shot, .empty { margin: 0; padding: 16px; background: var(--surface); }
.empty { border-left: 4px solid var(--ink); }
.issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.issue { padding: 16px; background: var(--surface); border-radius: 6px; scroll-margin-top: 16px; }
.issue:target { box-shadow: inset 4px 0 0 var(--signal), inset 6px 0 0 var(--halo); }
.tags { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; margin: 12px 0; font: 12px/1.6 var(--font-mono); color: var(--muted); }
.tags .severity { padding: 0 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid var(--ink); color: var(--ink); }
.tags .severity-error { background: var(--ink); color: var(--bg); }
.tags .severity-info { border-color: var(--muted); border-width: 1px; color: var(--muted); }
.message { margin: 0 0 12px; font-size: 16px; }
.details { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px 24px; margin: 0 0 12px; font-size: 14px; }
.details dt { font-weight: 700; margin-top: 8px; }
@media (min-width: 720px) { .details { grid-template-columns: 180px minmax(0, 1fr); } .details dt { margin-top: 0; } }
.details dd { margin: 0; overflow-wrap: anywhere; }
.details code { display: inline-block; margin: 0 8px 4px 0; }
.limits { padding: 32px 0; }
.limits p { max-width: 70ch; margin: 0; }
.footer { padding-top: 24px; padding-bottom: 48px; border-top: 1px solid var(--line); }
.footer p { color: var(--muted); font-size: 14px; margin: 0; }
@media print {
  .toggle, .skip { display: none; }
  :root { --bg: #ffffff; --surface: #ffffff; --ink: #000000; --muted: #333333; }
  .sign, .plate, .marker, .screen-sign { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .shot { position: static; }
  .issue { break-inside: avoid; border: 1px solid #999999; }
}
`;

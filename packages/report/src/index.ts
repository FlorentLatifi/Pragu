import type { Issue, PamScreen, ScanResult, Severity } from '@pragu/core';

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
 * Renders the walking-skeleton report: one self-contained HTML file with no
 * external requests. The visual design is a neutral baseline; the real design
 * system is chosen together with the project owner (docs/design/).
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
  <h1>${escapeHtml(headline)}</h1>
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
      return `<a class="marker" href="#issue-${String(number)}" style="${style}" aria-label="${escapeHtml(`Issue ${String(number)}: ${issue.title}`)}"><span class="marker-number" aria-hidden="true">${String(number)}</span></a>`;
    })
    .join('');
  const figure =
    screenshot === undefined
      ? '<p class="no-shot">No screenshot was captured for this screen.</p>'
      : `<figure class="shot">
      <div class="shot-frame">
        <img src="data:${screenshot.mimeType};base64,${screenshot.base64}" alt="${escapeHtml(`Screenshot of the ${screen.name} screen, with ${plural(numbered.length, 'numbered marker', 'numbered markers')}.`)}">
        ${markers}
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
  <h3><span class="issue-number" aria-hidden="true">${String(number)}</span>${escapeHtml(issue.title)}</h3>
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

// Baseline tokens: every text pair meets WCAG AA in both themes. Replaced by the chosen design system in M1.
const STYLES = `
:root {
  --paper: #f6f5f1; --surface: #ffffff; --ink: #17181a; --muted: #55585e; --line: #d9d7d0;
  --mark: #c2410c; --mark-ink: #ffffff; --error: #b42318; --warning: #8a5a00; --info: #3a5a8c;
  --focus: #1d4ed8;
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #121314; --surface: #1b1c1e; --ink: #ecebe6; --muted: #a9aaa5; --line: #34363a;
    --mark: #fb923c; --mark-ink: #121314; --error: #f97066; --warning: #f5c04a; --info: #93b4e8; --focus: #93c5fd;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --paper: #121314; --surface: #1b1c1e; --ink: #ecebe6; --muted: #a9aaa5; --line: #34363a;
  --mark: #fb923c; --mark-ink: #121314; --error: #f97066; --warning: #f5c04a; --info: #93b4e8; --focus: #93c5fd;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.6 var(--font-sans); }
a { color: inherit; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
code { font: 0.875em var(--font-mono); }
.skip { position: absolute; left: 16px; top: -48px; padding: 8px 12px; background: var(--surface); border: 1px solid var(--line); }
.skip:focus { top: 16px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.masthead, main, .footer { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
.masthead { padding-top: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
.masthead-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.eyebrow { margin: 0; font: 600 12px/1.4 var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 12px 0 8px; font-size: 28px; line-height: 1.25; font-weight: 650; }
h2 { font-size: 20px; line-height: 1.3; margin: 0 0 16px; }
h3 { font-size: 16px; line-height: 1.4; margin: 0; display: flex; gap: 12px; align-items: baseline; }
.meta, .rules, .where, figcaption { color: var(--muted); font-size: 14px; margin: 0; }
.toggle { min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer; }
.toggle[aria-pressed="true"] { border-color: var(--ink); }
.summary { padding: 24px 0; border-bottom: 1px solid var(--line); }
.counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin: 0 0 12px; }
.counts div { border-left: 2px solid var(--ink); padding-left: 12px; }
.counts dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.counts dd { margin: 0; font: 600 40px/1.1 var(--font-mono); }
.screen { padding: 32px 0; border-bottom: 1px solid var(--line); }
.screen-app { font: 400 14px var(--font-mono); color: var(--muted); margin-left: 8px; }
.notes { margin: -8px 0 16px; padding-left: 20px; color: var(--muted); font-size: 14px; }
.screen-grid { display: grid; gap: 32px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) { .screen-grid { grid-template-columns: 360px minmax(0, 1fr); align-items: start; } .shot { position: sticky; top: 16px; } }
.shot { margin: 0; max-width: 360px; }
.shot-frame { position: relative; border: 1px solid var(--line); background: var(--surface); line-height: 0; }
.shot-frame img { width: 100%; height: auto; display: block; }
.marker { position: absolute; border: 2px solid var(--mark); outline: 1px solid var(--surface); }
.marker-number { position: absolute; left: -2px; top: -26px; min-width: 24px; height: 24px; padding: 0 6px; background: var(--mark); color: var(--mark-ink); font: 700 14px/24px var(--font-mono); text-align: center; }
.no-shot, .empty { margin: 0; padding: 16px; border: 1px dashed var(--line); color: var(--muted); }
.issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.issue { padding: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
.issue:target { border-color: var(--mark); }
.issue-number { flex: none; min-width: 28px; height: 28px; background: var(--mark); color: var(--mark-ink); font: 700 14px/28px var(--font-mono); text-align: center; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; font-size: 12px; }
.tags span { padding: 2px 8px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
.tags .severity { font-weight: 700; border-color: currentColor; }
.severity-error { color: var(--error) !important; }
.severity-warning { color: var(--warning) !important; }
.severity-info { color: var(--info) !important; }
.message { margin: 0 0 12px; }
.details { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; margin: 0 0 12px; font-size: 14px; }
.details dt { font-weight: 600; margin-top: 8px; }
.details dd { margin: 0; }
.details code { display: inline-block; margin: 0 8px 4px 0; }
.limits { padding: 32px 0; }
.limits p { max-width: 70ch; margin: 0; }
.footer { padding-top: 24px; padding-bottom: 48px; border-top: 1px solid var(--line); }
.footer p { color: var(--muted); font-size: 14px; margin: 0; }
@media print {
  .toggle, .skip { display: none; }
  body { background: #fff; color: #000; }
  .shot { position: static; }
  .issue { break-inside: avoid; }
}
`;

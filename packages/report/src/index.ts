import { transcript } from '@pragu/core';
import type { BaselineSummary, Issue, PamScreen, ScanResult, Severity } from '@pragu/core';
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
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

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
  const numbered = numberIssues(result);
  const screens = result.screens
    .map((screen) => {
      const screenIssues = numbered.filter(({ issue }) => issue.screenId === screen.id);
      return renderScreen(
        screen,
        screenIssues,
        screenshots.get(screen.id),
        device.screenWidthPx,
        device.screenHeightPx,
        summary.baseline !== null,
      );
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
  ${summary.baseline === null ? '' : `<p class="baseline">${escapeHtml(`Compared with ${summary.baseline.file}: ${String(summary.baseline.newIssues)} new · ${String(summary.baseline.known)} already in the baseline · ${String(summary.baseline.fixed)} fixed since`)}</p>`}
  ${summary.ignored === 0 ? '' : `<p class="rules">${escapeHtml(plural(summary.ignored, 'issue', 'issues'))} ignored by the project's config (pragu.config.ts), not counted above.</p>`}
  ${renderFilters(issues, summary.baseline !== null)}
</section>
${renderRuleIndex(numbered, summary.rulesRun)}
${screens}
${summary.baseline === null ? '' : renderFixed(summary.baseline)}
<section class="limits" aria-labelledby="limits-heading">
  <h2 id="limits-heading">What these checks cannot tell you</h2>
  <p>Automated checks find some barriers, not all, and this report is not a compliance statement. Still check by hand: whether names are meaningful in context, the reading order across the whole screen, behaviour at 200% text size, gestures and timing, and the full journey with TalkBack switched on.</p>
</section>
</main>
<footer class="footer">
  <p>${escapeHtml(`Pragu ${result.tool.version} · result schema ${result.schemaVersion}`)} · Generated on this machine; nothing was uploaded.</p>
</footer>
<script>${SCRIPT}${FILTER_SCRIPT}</script>
</body>
</html>
`;
}

interface NumberedIssue {
  issue: Issue;
  number: number;
}

/** One number per issue across the whole report, screen by screen, matching the screenshot signs. */
function numberIssues(result: ScanResult): NumberedIssue[] {
  return result.screens
    .flatMap((screen) => result.issues.filter((issue) => issue.screenId === screen.id))
    .map((issue, index) => ({ issue, number: index + 1 }));
}

/**
 * The same issues grouped by rule, worst first: when one rule fires several times, that is
 * usually one fix in a shared component. Links back to the numbered cards rather than
 * repeating them, so the file stays small.
 */
function renderRuleIndex(numbered: readonly NumberedIssue[], rulesRun: readonly string[]): string {
  if (numbered.length === 0) return '';
  const byRule = new Map<string, { first: Issue; entries: NumberedIssue[] }>();
  for (const entry of numbered) {
    const group = byRule.get(entry.issue.ruleId);
    if (group === undefined) byRule.set(entry.issue.ruleId, { first: entry.issue, entries: [entry] });
    else group.entries.push(entry);
  }
  const groups = [...byRule.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.first.severity] - SEVERITY_ORDER[b.first.severity] ||
      b.entries.length - a.entries.length ||
      a.first.ruleId.localeCompare(b.first.ruleId),
  );
  const rows = groups.map(({ first, entries }) => renderRuleRow(first, entries)).join('\n');
  const quiet = rulesRun.filter((id) => !byRule.has(id)).length;
  const quietNote =
    quiet === 0
      ? ''
      : `<p class="rules">${escapeHtml(plural(quiet, 'other check', 'other checks'))} found nothing.</p>`;
  return `<section class="by-rule" aria-labelledby="by-rule-heading">
  <h2 id="by-rule-heading">By rule</h2>
  <ul class="rule-index">
  ${rows}
  </ul>
  ${quietNote}
</section>`;
}

function renderRuleRow(first: Issue, entries: readonly NumberedIssue[]): string {
  const { ruleId, title, severity } = first;
  const links = entries
    .map(
      ({ number }) =>
        `<a class="plate" href="#issue-${String(number)}" data-issue="${String(number)}" aria-label="${escapeHtml(`Issue ${String(number)}`)}">${String(number)}</a>`,
    )
    .join('');
  return `<li class="rule-row">
    <span class="severity severity-${severity}">${SEVERITY_LABEL[severity]}</span>
    <span class="rule-name"><span class="rule-title">${escapeHtml(title)}</span> <code>${escapeHtml(ruleId)}</code></span>
    <span class="rule-count">${escapeHtml(plural(entries.length, 'issue', 'issues'))}</span>
    <span class="rule-links">${links}</span>
  </li>`;
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
  title: string;
  measure: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Signs are links, so they keep a gap: on a narrower screenshot the percentages shrink but the signs do not. */
function overlaps(a: PlacedSign, b: PlacedSign, gapX: number, gapY: number): boolean {
  return (
    a.left < b.left + b.width + gapX &&
    b.left < a.left + a.width + gapX &&
    a.top < b.top + b.height + gapY &&
    b.top < a.top + a.height + gapY
  );
}

/**
 * Each marker gets one sign with its number and measurement ("1 · no name"), placed
 * just above the marker (below it at the top of the screen). A sign that would cover
 * one already placed steps further away; its number still ties it to its marker.
 */
function placeSigns(numbered: readonly NumberedIssue[], screenWidthPx: number, screenHeightPx: number): PlacedSign[] {
  const frameHeightPx = (FRAME_WIDTH_PX * screenHeightPx) / screenWidthPx;
  const height = (SIGN_HEIGHT_PX / frameHeightPx) * 100;
  const gap = (SIGN_GAP_PX / frameHeightPx) * 100;
  const gapX = (SIGN_GAP_PX / FRAME_WIDTH_PX) * 100;
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
      title: issue.title,
      measure,
      width,
      height,
      left: Math.min(Math.max((left / screenWidthPx) * 100, 0), 100 - width),
      top: below ? (bottom / screenHeightPx) * 100 + gap : (top / screenHeightPx) * 100 - gap - height,
    };
    while (placed.some((other) => overlaps(sign, other, gapX, gap))) sign.top += below ? height + gap : -(height + gap);
    placed.push(sign);
  }
  return placed;
}

function renderScreen(
  screen: PamScreen,
  numbered: readonly NumberedIssue[],
  screenshot: ReportScreenshot | undefined,
  screenWidthPx: number,
  screenHeightPx: number,
  compared: boolean,
): string {
  const headingId = `${screen.id}-heading`;
  const markers = numbered
    .map(({ issue, number }) => {
      const { left, top, right, bottom } = issue.boundsPx;
      const box = `left:${percent(left, screenWidthPx)};top:${percent(top, screenHeightPx)};width:${percent(right - left, screenWidthPx)};height:${percent(bottom - top, screenHeightPx)}`;
      // Only a drawing: barriers are often small and close together, so the outline cannot
      // be a 24 px target (WCAG 2.5.8). The numbered sign beside it is the link.
      return `<span class="marker-box" data-issue="${String(number)}" style="${box}" aria-hidden="true"></span>`;
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
      return `<a class="screen-sign" href="#issue-${String(sign.number)}" data-issue="${String(sign.number)}" style="left:${sign.left.toFixed(3)}%;top:${sign.top.toFixed(3)}%" aria-label="${escapeHtml(`Issue ${String(sign.number)}${sign.measure === null ? '' : `, ${sign.measure}`}: ${sign.title}`)}"><span class="sign-number">${String(sign.number)}</span> ${measure}</a>`;
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
      : `<ol class="issues">${numbered.map(({ issue, number }) => renderIssue(issue, number, compared)).join('\n')}</ol>
    <p class="empty filtered-empty" hidden>The filters hide every issue on this screen.</p>`;
  const notes = screenNotes(screen);
  const notesList =
    notes.length === 0 ? '' : `<ul class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`;
  return `<section class="screen" aria-labelledby="${headingId}">
  <h2 id="${headingId}">${escapeHtml(screen.name)} <span class="screen-app">${escapeHtml(screen.appId)}</span></h2>
  ${notesList}
  <div class="screen-grid">
    ${figure}
    <div>
    ${list}
    ${renderTranscript(screen, numbered)}
    </div>
  </div>
</section>`;
}

/**
 * The screen as a TalkBack user hears it, swiping from start to end. Lines whose element has
 * a finding carry its number, so a barrier can be heard, not only seen.
 */
function renderTranscript(screen: PamScreen, numbered: readonly NumberedIssue[]): string {
  const headingId = `${screen.id}-transcript`;
  const lines = transcript(screen);
  const numbersFor = (nodeId: string) =>
    numbered
      .filter(({ issue }) => issue.nodeId === nodeId)
      .map(
        ({ number }) =>
          `<span class="plate" data-issue="${String(number)}" aria-label="${escapeHtml(`Issue ${String(number)}`)}">${String(number)}</span>`,
      )
      .join('');
  const body =
    lines.length === 0
      ? '<p class="empty">Nothing on this screen reaches a screen reader. That is a barrier in itself: check that the screen is not hidden from accessibility.</p>'
      : `<ol class="transcript-lines">${lines.map((line) => `<li>${numbersFor(line.nodeId)}<span>${escapeHtml(line.text)}</span></li>`).join('')}</ol>`;
  return `<section class="transcript" aria-labelledby="${headingId}">
      <h3 id="${headingId}">What a screen reader says</h3>
      <p class="transcript-note">Pragu's approximation of TalkBack swiping through this screen, in order. A real device can word or order it differently, so check with TalkBack on.</p>
      ${body}
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

/**
 * Filters for severity and, with a baseline, for new issues only. The form starts hidden
 * and the script reveals it, so a reader without scripts never sees controls that do nothing.
 */
function renderFilters(issues: readonly Issue[], compared: boolean): string {
  if (issues.length === 0) return '';
  const severities = (['error', 'warning', 'info'] as const)
    .map((severity) => ({ severity, count: issues.filter((issue) => issue.severity === severity).length }))
    .filter(({ count }) => count > 0)
    .map(
      ({ severity, count }) =>
        `<label class="filter"><input type="checkbox" name="severity" value="${severity}" checked> ${SEVERITY_LABEL[severity]} <span class="filter-count">${String(count)}</span></label>`,
    )
    .join('');
  const newCount = issues.filter((issue) => !issue.inBaseline).length;
  const baseline = compared
    ? `<fieldset>
      <legend>Baseline</legend>
      <label class="filter"><input type="radio" name="baseline" value="all" checked> All issues</label>
      <label class="filter"><input type="radio" name="baseline" value="new"> New only <span class="filter-count">${String(newCount)}</span></label>
    </fieldset>`
    : '';
  return `<form class="filters" id="filters" hidden>
    <fieldset>
      <legend>Severity</legend>
      ${severities}
    </fieldset>
    ${baseline}
    <p class="filter-status" id="filter-status" role="status"></p>
  </form>`;
}

/** With a baseline, every issue says which side of it it is on; without one, nothing. */
function baselineTag(issue: Issue, compared: boolean): string {
  if (issue.inBaseline) return '<span class="in-baseline">In baseline</span>';
  return compared ? '<span class="is-new">New</span>' : '';
}

/** What got better since the baseline: issues it accepted that this scan no longer finds. */
function renderFixed(baseline: BaselineSummary): string {
  const body =
    baseline.fixedIssues.length === 0
      ? '<p class="empty">None yet: every issue the baseline accepts on these screens is still there.</p>'
      : `<ul class="fixed-list">${baseline.fixedIssues
          .map(
            (entry) =>
              `<li><p class="fixed-where"><code>${escapeHtml(entry.ruleId)}</code> · ${escapeHtml(entry.screen)}${entry.resourceId === null ? '' : ` · <code>${escapeHtml(entry.resourceId)}</code>`}</p><p class="fixed-message">${escapeHtml(entry.message)}</p></li>`,
          )
          .join('')}</ul>`;
  return `<section class="fixed" aria-labelledby="fixed-heading">
  <h2 id="fixed-heading">Fixed since the baseline</h2>
  <p class="rules">${escapeHtml(`Accepted in ${baseline.file}, no longer found by this scan.`)} Run <code>pragu baseline update</code> to drop them from the baseline.</p>
  ${body}
</section>`;
}

function renderIssue(issue: Issue, number: number, compared: boolean): string {
  const evidence = Object.entries(issue.evidence)
    .map(([key, value]) => `<code>${escapeHtml(key)}: ${escapeHtml(String(value))}</code>`)
    .join(' ');
  const standards = [
    ...issue.wcag.map((sc) => `WCAG ${sc}`),
    ...issue.en301549.map((clause) => `EN 301 549 ${clause}`),
  ];
  const element = issue.resourceId === null ? '' : `Element <code>${escapeHtml(issue.resourceId)}</code> · `;
  const baseline = compared ? ` data-baseline="${issue.inBaseline ? 'known' : 'new'}"` : '';
  return `<li class="issue" id="issue-${String(number)}" tabindex="-1" data-issue="${String(number)}" data-severity="${issue.severity}"${baseline}>
  <h3><span class="plate" aria-hidden="true">${String(number)}</span>${escapeHtml(issue.title)}</h3>
  <p class="tags"><span class="severity severity-${issue.severity}">${SEVERITY_LABEL[issue.severity]}</span>${standards.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}<span>Confidence: ${issue.confidence}</span>${baselineTag(issue, compared)}</p>
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

// Filters hide issue cards and their markers, and dim their signs on the screenshot, so the
// numbers that stay bright are the ones being looked at.
const FILTER_SCRIPT = `(function () {
  var form = document.getElementById('filters');
  if (!form) return;
  var status = document.getElementById('filter-status');
  var issues = Array.prototype.slice.call(document.querySelectorAll('.issue[data-issue]'));
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
  function apply() {
    var severities = Array.prototype.map.call(form.querySelectorAll('input[name="severity"]:checked'), function (input) { return input.value; });
    var newOnly = !!form.querySelector('input[name="baseline"][value="new"]:checked');
    var shown = {};
    var count = 0;
    issues.forEach(function (issue) {
      var visible = severities.indexOf(issue.getAttribute('data-severity')) !== -1 && (!newOnly || issue.getAttribute('data-baseline') === 'new');
      issue.hidden = !visible;
      if (visible) { shown[issue.getAttribute('data-issue')] = true; count++; }
    });
    each('.marker-box[data-issue], .rule-links [data-issue]', function (el) { el.hidden = !shown[el.getAttribute('data-issue')]; });
    each('.screen-sign[data-issue], .transcript-lines [data-issue]', function (el) { el.classList.toggle('is-dimmed', !shown[el.getAttribute('data-issue')]); });
    each('.screen-sign[data-issue]', function (el) {
      var off = !shown[el.getAttribute('data-issue')];
      if (off) { el.setAttribute('tabindex', '-1'); el.setAttribute('aria-hidden', 'true'); } else { el.removeAttribute('tabindex'); el.removeAttribute('aria-hidden'); }
    });
    each('.rule-row', function (row) { row.hidden = !row.querySelector('.rule-links [data-issue]:not([hidden])'); });
    each('.issues', function (list) { list.nextElementSibling.hidden = !!list.querySelector('.issue:not([hidden])'); });
    status.textContent = count === issues.length ? 'Showing all ' + issues.length + ' issues.' : 'Showing ' + count + ' of ' + issues.length + ' issues.';
  }
  form.hidden = false;
  form.addEventListener('change', apply);
  apply();
})();`;

// Direction "Signal" (DESIGN.md). Tokens come from theme.ts; this sheet only uses the variables.
const STYLES = `${FONT_FACES}
${themeCss()}
:root {
  --font-text: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-mono: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
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
.marker-box { position: absolute; border: 3px solid var(--signal); box-shadow: 0 0 0 2px var(--halo), inset 0 0 0 1px var(--halo); pointer-events: none; }
.screen-sign { position: absolute; display: flex; align-items: stretch; height: 24px; background: var(--signal); color: var(--on-signal); border: 2px solid var(--halo); white-space: nowrap; min-width: 24px; text-decoration: none; z-index: 1; }
.sign-number { padding: 0 5px; font: 700 13px/20px var(--font-mono); }
.sign-measure { padding: 0 5px; border-left: 2px solid var(--halo); font: 700 11px/20px var(--font-mono); }
.screen-sign:focus-visible { outline-offset: 2px; z-index: 2; }
.no-shot, .empty { margin: 0; padding: 16px; background: var(--surface); }
.empty { border-left: 4px solid var(--ink); }
.issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.issue { padding: 16px; background: var(--surface); border-radius: 6px; scroll-margin-top: 16px; }
.issue:target { box-shadow: inset 4px 0 0 var(--signal), inset 6px 0 0 var(--halo); }
.tags { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; margin: 12px 0; font: 12px/1.6 var(--font-mono); color: var(--muted); }
.severity { padding: 0 8px; font: 700 12px/1.6 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid var(--ink); color: var(--ink); }
.severity-error { background: var(--ink); color: var(--bg); }
.severity-info { border-color: var(--muted); border-width: 1px; color: var(--muted); }
.filters { display: flex; flex-wrap: wrap; gap: 8px 32px; align-items: flex-end; margin: 16px 0 0; }
.filters fieldset { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 0; padding: 0; border: 0; }
.filters legend { padding: 0; font: 700 12px/1.4 var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.filter { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 700; cursor: pointer; }
.filter input { width: 20px; height: 20px; margin: 0; accent-color: var(--ink); }
.filter-count { font: 400 14px var(--font-mono); color: var(--muted); }
.filter-status { flex-basis: 100%; margin: 0; color: var(--muted); font-size: 14px; }
.screen-sign.is-dimmed, .plate.is-dimmed { background: var(--surface); color: var(--muted); border-style: dashed; border-color: var(--muted); z-index: 0; }
.screen-sign.is-dimmed .sign-measure { border-left-color: var(--muted); }
.screen-sign.is-dimmed { pointer-events: none; }
.by-rule { padding: 32px 0; border-bottom: 1px solid var(--line); }
.rule-index { list-style: none; margin: 0 0 12px; padding: 0; }
.rule-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); }
@media (min-width: 720px) { .rule-row { grid-template-columns: 96px minmax(0, 1fr) 88px minmax(0, auto); } }
.rule-row .severity { justify-self: start; }
.rule-title { font-weight: 700; }
.rule-name code { color: var(--muted); overflow-wrap: anywhere; }
.rule-count { font: 14px var(--font-mono); color: var(--muted); }
.rule-links { display: flex; flex-wrap: wrap; gap: 8px; }
.rule-links .plate { min-width: 32px; height: 32px; line-height: 28px; text-decoration: none; }
.tags .in-baseline { padding: 0 8px; border: 1px dashed var(--muted); }
.tags .is-new { padding: 0 8px; background: var(--signal); color: var(--on-signal); border: 2px solid var(--halo); font-weight: 700; }
.fixed { padding: 32px 0; border-bottom: 1px solid var(--line); }
.fixed .rules { margin-bottom: 16px; }
.fixed-list { list-style: none; margin: 0; padding: 0; }
.fixed-list li { padding: 12px 0 12px 16px; border-left: 4px solid var(--ink); }
.fixed-list li + li { margin-top: 8px; }
.fixed-where { margin: 0; font: 14px var(--font-mono); color: var(--muted); overflow-wrap: anywhere; }
.fixed-message { margin: 4px 0 0; }
.baseline { margin: 12px 0 0; padding: 8px 12px; background: var(--surface); font: 700 14px/1.5 var(--font-mono); }
.message { margin: 0 0 12px; font-size: 16px; }
.details { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px 24px; margin: 0 0 12px; font-size: 14px; }
.details dt { font-weight: 700; margin-top: 8px; }
@media (min-width: 720px) { .details { grid-template-columns: 180px minmax(0, 1fr); } .details dt { margin-top: 0; } }
.details dd { margin: 0; overflow-wrap: anywhere; }
.details code { display: inline-block; margin: 0 8px 4px 0; }
.transcript { margin-top: 32px; }
.transcript-note { margin: 4px 0 12px; color: var(--muted); font-size: 14px; }
.transcript-lines { margin: 0; padding: 0 0 0 32px; font: 14px/1.6 var(--font-mono); }
.transcript-lines li { padding: 4px 0; border-bottom: 1px solid var(--line); }
.transcript-lines li::marker { color: var(--muted); }
.transcript-lines .plate { margin-right: 8px; }
.limits { padding: 32px 0; }
.limits p { max-width: 70ch; margin: 0; }
.footer { padding-top: 24px; padding-bottom: 48px; border-top: 1px solid var(--line); }
.footer p { color: var(--muted); font-size: 14px; margin: 0; }
@media print {
  .toggle, .skip, .filters { display: none; }
  :root { --bg: #ffffff; --surface: #ffffff; --ink: #000000; --muted: #333333; }
  .sign, .plate, .marker-box, .screen-sign { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .shot { position: static; }
  .issue { break-inside: avoid; border: 1px solid #999999; }
}
`;

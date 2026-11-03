// A page for labelling one recorded screen blind (ADR-015): it shows the screenshot and the
// elements of the tree, never what Pragu reports. The labeller picks a rule, clicks elements
// to mark them as barriers or correct, and copies the JSON into the app's expected.json.

import { normalizeAndroidCapture, parseAndroidCapture } from '@pragu/core';
import type { PamNode } from '@pragu/core';

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Elements worth a label: what a person sees or can act on in the app's own windows. */
function candidates(nodes: readonly PamNode[], appWindows: ReadonlySet<number>): PamNode[] {
  return nodes.filter(
    (node) =>
      appWindows.has(node.window) &&
      node.visible &&
      (node.interactive || node.focusable || node.text !== null || node.role === 'image' || node.role === 'textfield'),
  );
}

export function renderLabelPage(
  captureJson: unknown,
  png: Buffer,
  screen: { id: string; name: string },
  ruleIds: readonly string[],
): string {
  const capture = parseAndroidCapture(captureJson);
  const { screen: pam } = normalizeAndroidCapture(capture, {
    screenId: screen.id,
    screenName: screen.name,
    screenshotFile: null,
  });
  const appWindows = new Set(pam.windows.flatMap((window, index) => (window.kind === 'app' ? [index] : [])));
  const elements = candidates(pam.nodes, appWindows);
  const width = capture.screenWidthPx;
  const height = capture.screenHeightPx;
  const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;
  const boxes = elements
    .map((node) => {
      const { left, top, right, bottom } = node.boundsPx;
      const label = `${node.id}: ${node.role}${node.name === null ? '' : ` "${node.name}"`}`;
      return `<button type="button" class="box" data-node="${escape(node.id)}" aria-label="${escape(label)}" title="${escape(label)}" style="left:${percent(left, width)};top:${percent(top, height)};width:${percent(right - left, width)};height:${percent(bottom - top, height)}"></button>`;
    })
    .join('');
  const rows = elements
    .map(
      (node) =>
        `<tr data-node="${escape(node.id)}"><td><code>${escape(node.id)}</code></td><td>${escape(node.role)}</td><td>${escape(node.name ?? '')}</td><td>${escape(node.text ?? '')}</td><td>${escape(node.resourceId ?? '')}</td><td class="mark"></td></tr>`,
    )
    .join('');
  const options = ruleIds.map((id) => `<option>${escape(id)}</option>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(`Label ${screen.name}`)}</title>
<style>
body { margin: 0; padding: 16px; font: 15px/1.5 system-ui, sans-serif; color: #1a1a18; background: #f7f6f3; }
main { display: grid; gap: 24px; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); align-items: start; }
.shot { position: relative; }
.shot img { width: 100%; display: block; }
.box { position: absolute; padding: 0; border: 2px solid #5e5c57; background: transparent; cursor: pointer; }
.box[data-mark="barrier"] { border: 3px solid #a8432f; background: rgba(168, 67, 47, 0.25); }
.box[data-mark="correct"] { border: 3px solid #2f6f45; background: rgba(47, 111, 69, 0.25); }
.box:focus-visible { outline: 3px solid #1a1a18; outline-offset: 2px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
td { border-bottom: 1px solid #e4e2dc; padding: 4px 8px; vertical-align: top; overflow-wrap: anywhere; }
tr.current td { background: #fff3c4; }
textarea { width: 100%; min-height: 200px; font: 12px ui-monospace, monospace; }
label, select { font: inherit; }
</style>
</head>
<body>
<h1>${escape(screen.name)} <small>(${escape(screen.id)})</small></h1>
<p>Blind labelling: Pragu's findings are not on this page. Follow bench/real/PROTOCOL.md. Pick a rule, then click an element: once for barrier, twice for correct, three times to clear. Unmarked elements are "not applicable".</p>
<p><label>Rule <select id="rule">${options}</select></label></p>
<main>
  <div class="shot"><img src="data:image/png;base64,${png.toString('base64')}" alt="${escape(`Screenshot of ${screen.name}`)}">${boxes}</div>
  <div>
    <table><thead><tr><th>Node</th><th>Role</th><th>Name</th><th>Text</th><th>Id</th><th>Mark</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>For expected.json</h2>
    <textarea id="out" readonly aria-label="Labels as JSON"></textarea>
  </div>
</main>
<script>
(function () {
  var screen = ${JSON.stringify({ id: screen.id, name: screen.name })};
  var marks = {};
  var rule = document.getElementById('rule');
  var out = document.getElementById('out');
  var order = ['barrier', 'correct', undefined];
  function render() {
    var current = marks[rule.value] || {};
    document.querySelectorAll('[data-node]').forEach(function (el) {
      var mark = current[el.getAttribute('data-node')];
      if (el.classList.contains('box')) { if (mark) el.setAttribute('data-mark', mark); else el.removeAttribute('data-mark'); el.setAttribute('aria-pressed', String(!!mark)); }
      else el.querySelector('.mark').textContent = mark || '';
    });
    var barriers = [], correctTwins = [];
    Object.keys(marks).sort().forEach(function (id) {
      Object.keys(marks[id]).sort().forEach(function (node) {
        (marks[id][node] === 'barrier' ? barriers : correctTwins).push({ rule: id, node: node });
      });
    });
    out.value = JSON.stringify({ id: screen.id, name: screen.name, barriers: barriers, correctTwins: correctTwins }, null, 2);
  }
  document.querySelectorAll('.box').forEach(function (box) {
    box.addEventListener('click', function () {
      var node = box.getAttribute('data-node');
      var current = marks[rule.value] = marks[rule.value] || {};
      var next = order[(order.indexOf(current[node]) + 1) % order.length];
      if (next) current[node] = next; else delete current[node];
      render();
    });
    box.addEventListener('focus', function () {
      document.querySelectorAll('tr.current').forEach(function (row) { row.classList.remove('current'); });
      var row = document.querySelector('tr[data-node="' + box.getAttribute('data-node') + '"]');
      if (row) row.classList.add('current');
    });
  });
  rule.addEventListener('change', render);
  render();
})();
</script>
</body>
</html>
`;
}

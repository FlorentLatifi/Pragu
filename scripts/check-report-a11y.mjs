// Renders real reports from bench recordings and checks them with axe-core in a real browser:
// light and dark, phone and desktop width, before and after filtering. Also checks that the
// filters do what they say. Fails on any WCAG 2.2 A/AA violation axe finds.
// Usage: pnpm build && node scripts/check-report-a11y.mjs
// Uses the installed Chrome (or Edge); PRAGU_BROWSER=msedge|chrome|chromium picks one.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const { renderReport } = await import('../packages/report/dist/index.js');

const repo = fileURLToPath(new URL('..', import.meta.url));
const recordings = join(repo, 'bench', 'recordings');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 900 },
];

function pragu(args) {
  const run = spawnSync(process.execPath, [join(repo, 'packages/cli/dist/bin.js'), ...args], { encoding: 'utf8' });
  // Exit 1 means barriers were found, which is what these recordings are for.
  if (run.status !== 0 && run.status !== 1) throw new Error(`pragu ${args.join(' ')} failed:\n${run.stderr}`);
}

/** Reports that cover every part of the page: issues, a baseline diff, images and the empty state. */
async function renderCases(dir) {
  pragu(['scan', '--from-capture', join(recordings, 'rn-shop/cart.json'), '--out', join(dir, 'cart')]);
  pragu(['scan', '--from-capture', join(recordings, 'rn-shop/product.json'), '--out', join(dir, 'product')]);

  const settings = join(recordings, 'android-compose/settings.json');
  pragu(['scan', '--from-capture', settings, '--out', join(dir, 'settings')]);
  const baselineFile = join(dir, 'baseline.json');
  pragu(['baseline', 'create', '--from', join(dir, 'settings/pragu-result.json'), '--out', baselineFile]);
  // One accepted issue goes missing (so one is new) and one that no longer exists is added (so one is fixed).
  const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
  const [dropped] = baseline.issues.splice(0, 1);
  baseline.issues.push({ ...dropped, fingerprint: '0000000000000000', message: 'An issue fixed since.' });
  await writeFile(baselineFile, JSON.stringify(baseline));
  pragu(['scan', '--from-capture', settings, '--baseline', baselineFile, '--out', join(dir, 'diff')]);

  const result = JSON.parse(await readFile(join(dir, 'cart/pragu-result.json'), 'utf8'));
  const png = await readFile(join(recordings, 'rn-shop/cart.png'));
  const empty = {
    ...result,
    issues: [],
    summary: { ...result.summary, errors: 0, warnings: 0, infos: 0 },
  };
  const screenshots = new Map([[result.screens[0].id, { mimeType: 'image/png', base64: png.toString('base64') }]]);
  await mkdir(join(dir, 'empty'), { recursive: true });
  await writeFile(join(dir, 'empty/pragu-report.html'), renderReport({ result: empty, screenshots }));

  return ['cart', 'product', 'diff', 'empty'].map((name) => ({ name, file: join(dir, name, 'pragu-report.html') }));
}

async function launch() {
  const channels = process.env.PRAGU_BROWSER ? [process.env.PRAGU_BROWSER] : ['chrome', 'msedge'];
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error(`No browser found (tried ${channels.join(', ')}). Install Chrome or set PRAGU_BROWSER.`);
}

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(
    (tags) =>
      globalThis.axe.run(globalThis.document, { runOnly: { type: 'tag', values: tags } }).then((r) => r.violations),
    WCAG_TAGS,
  );
}

function describe(label, violations) {
  return violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
  );
}

/** The filters must hide what they say, dim the signs, and keep the status line honest. */
async function checkFilters(page) {
  const problems = [];
  const total = await page.locator('.issue').count();
  const errors = await page.locator('.issue[data-severity="error"]').count();
  await page.locator('input[name="severity"][value="error"]').uncheck();
  const visible = await page.locator('.issue:visible').count();
  if (visible !== total - errors) problems.push(`unchecking Error left ${visible} cards, expected ${total - errors}`);
  const status = await page.locator('#filter-status').textContent();
  if (status !== `Showing ${total - errors} of ${total} issues.`) problems.push(`status line says "${status}"`);
  if ((await page.locator('.screen-sign.is-dimmed').count()) !== errors) problems.push('error signs are not dimmed');
  await page.locator('input[name="severity"][value="error"]').check();
  await page.locator('input[name="baseline"][value="new"]').check();
  const newCards = await page.locator('.issue:visible').count();
  if (newCards !== (await page.locator('.issue[data-baseline="new"]').count()))
    problems.push('"New only" shows known issues');
  return problems;
}

const dir = await mkdtemp(join(tmpdir(), 'pragu-a11y-'));
const failures = [];
let runs = 0;
const browser = await launch();
try {
  for (const report of await renderCases(dir)) {
    for (const viewport of VIEWPORTS) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport, colorScheme });
        const page = await context.newPage();
        await page.goto(pathToFileURL(report.file).href);
        const label = `${report.name} ${viewport.name} ${colorScheme}`;
        failures.push(...describe(label, await axe(page)));
        runs++;
        if (report.name === 'diff') {
          const problems = await checkFilters(page);
          failures.push(...problems.map((problem) => `${label} filters: ${problem}`));
          failures.push(...describe(`${label} filtered`, await axe(page)));
          runs++;
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Report accessibility check failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Report accessibility check passed: ${runs} axe runs (WCAG 2.2 A/AA), filters work.`);

// Checks the built docs site with axe-core in a real browser: a few representative pages,
// light and dark, phone and desktop. Fails on any WCAG 2.2 A/AA violation axe finds.
// Usage: pnpm --dir apps/docs build && node scripts/check-docs-a11y.mjs
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const dist = fileURLToPath(new URL('../apps/docs/dist/', import.meta.url));
const BASE = '/Pragu/';
const PAGES = ['', 'getting-started/', 'guides/ci/', 'rules/contrast-text/', 'reference/cli/', 'accessibility-101/'];
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

// The site is built for GitHub Pages under /Pragu/; serve it the same way.
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relative = path.startsWith(BASE) ? path.slice(BASE.length) : path;
  let file = normalize(join(dist, relative));
  if (!file.startsWith(dist.endsWith(sep) ? dist : dist + sep)) return response.writeHead(403).end();
  if (relative === '' || relative.endsWith('/')) file = join(file, 'index.html');
  let body;
  try {
    body = await readFile(file);
  } catch {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
const address = server.address();
const origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? String(address.port) : ''}`;

async function launch() {
  for (const channel of process.env.PRAGU_BROWSER ? [process.env.PRAGU_BROWSER] : ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('No browser found. Install Chrome or set PRAGU_BROWSER.');
}

const failures = [];
let runs = 0;
const browser = await launch();
try {
  for (const path of PAGES) {
    for (const theme of ['light', 'dark']) {
      for (const width of [375, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.addInitScript((value) => {
          globalThis.localStorage.setItem('starlight-theme', value);
        }, theme);
        await page.goto(`${origin}${BASE}${path}`);
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate(() =>
          globalThis.axe
            .run(globalThis.document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
            })
            .then((result) => result.violations),
        );
        runs++;
        for (const v of violations) {
          failures.push(
            `/${path} ${theme} ${String(width)}: ${v.id} ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
          );
        }
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length > 0) {
  console.error(`Docs accessibility check failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Docs accessibility check passed: ${String(runs)} axe runs (WCAG 2.2 A/AA).`);

// Packs the three npm packages and installs them, with npm, into an empty folder, the way a
// user would get them from the registry; then runs the installed `pragu` on a recorded screen.
// Catches what the monorepo hides: a file missing from "files", a dependency not declared.
// Usage: pnpm build && node scripts/check-package-install.mjs [--tarballs <dir>] [--require-agent]
//   --tarballs <dir>   install the .tgz files already in <dir> instead of packing new ones; the
//                      release passes its own folder, so the bytes it publishes are the bytes tested
//   --require-agent    fail unless the installed pragu carries the agent APK that matches its SHA-256 file
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', shell: windows, stdio: ['ignore', 'pipe', 'pipe'] });

const { values: options } = parseArgs({
  options: { tarballs: { type: 'string' }, 'require-agent': { type: 'boolean', default: false } },
});
const PACKAGES = ['core', 'report', 'cli'];

/** The three package tarballs in a folder that also holds the release's APK, SBOM and checksums. */
async function existingTarballs(folder) {
  const tarballs = (await readdir(folder)).filter((name) => name.endsWith('.tgz')).map((name) => join(folder, name));
  if (tarballs.length !== PACKAGES.length) {
    throw new Error(
      `Expected ${String(PACKAGES.length)} package tarballs in ${folder}, found ${String(tarballs.length)}.`,
    );
  }
  return tarballs;
}

/** The agent the installed pragu would push to a device must be the one its checksum file names. */
async function checkBundledAgent(app) {
  const agent = join(app, 'node_modules', 'pragu', 'agent');
  const apk = join(agent, 'pragu-agent.apk');
  const sumFile = join(agent, 'pragu-agent.sha256');
  if (!existsSync(apk) || !existsSync(sumFile)) {
    throw new Error('The installed pragu has no bundled agent (agent/pragu-agent.apk and pragu-agent.sha256).');
  }
  const expected = (await readFile(sumFile, 'utf8')).trim().split(/\s+/)[0];
  const actual = createHash('sha256')
    .update(await readFile(apk))
    .digest('hex');
  if (actual !== expected)
    throw new Error(`The bundled agent's SHA-256 is ${actual}; its checksum file says ${expected}.`);
  return actual;
}

const dir = await mkdtemp(join(tmpdir(), 'pragu-install-'));
try {
  let tarballs;
  if (options.tarballs === undefined) {
    const packs = join(dir, 'packs');
    for (const pkg of PACKAGES) run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages', pkg));
    tarballs = (await readdir(packs)).map((name) => join(packs, name));
  } else {
    tarballs = await existingTarballs(resolve(options.tarballs));
  }
  const app = join(dir, 'app');
  await mkdir(app, { recursive: true });
  run('npm', ['init', '-y'], app);
  run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], app);
  const bin = join(app, 'node_modules', '.bin', windows ? 'pragu.cmd' : 'pragu');
  if (!existsSync(bin)) throw new Error('npm installed the packages but no pragu command.');
  const version = run(bin, ['--version'], app).trim();
  const rules = run(bin, ['rules'], app);
  const out = join(dir, 'out');
  let scan = '';
  try {
    run(
      bin,
      [
        'scan',
        '--from-capture',
        join(root, 'bench', 'recordings', 'rn-shop', 'cart.json'),
        '--out',
        out,
        '--format',
        'html,json,sarif',
      ],
      app,
    );
  } catch (error) {
    // Exit 1 means barriers were found, which this recording has.
    scan = String(error.stdout ?? '');
    if (error.status !== 1) throw error;
  }
  for (const file of ['pragu-report.html', 'pragu-result.json', 'pragu-results.sarif']) {
    if (!existsSync(join(out, file))) throw new Error(`The installed pragu did not write ${file}.\n${scan}`);
  }
  const agent = options['require-agent']
    ? ` The bundled agent matches its SHA-256 (${await checkBundledAgent(app)}).`
    : '';
  console.log(
    `Installed pragu ${version} from packed tarballs: ${rules.split('\n')[0]} A scan wrote the report, JSON and SARIF.${agent}`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}

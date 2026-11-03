// Packs the three npm packages and installs them, with npm, into an empty folder, the way a
// user would get them from the registry; then runs the installed `pragu` on a recorded screen.
// Catches what the monorepo hides: a file missing from "files", a dependency not declared.
// Usage: pnpm build && node scripts/check-package-install.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', shell: windows, stdio: ['ignore', 'pipe', 'pipe'] });

const dir = await mkdtemp(join(tmpdir(), 'pragu-install-'));
try {
  const packs = join(dir, 'packs');
  for (const pkg of ['core', 'report', 'cli'])
    run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages', pkg));
  const tarballs = (await readdir(packs)).map((name) => join(packs, name));
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
  console.log(
    `Installed pragu ${version} from packed tarballs: ${rules.split('\n')[0]} A scan wrote the report, JSON and SARIF.`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}

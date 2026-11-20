// Smoke checks for the published `pragu` package, run by .github/workflows/quickstart.yml.
// Usage:
//   node scripts/quickstart-smoke.mjs cli  <version|latest>
//   node scripts/quickstart-smoke.mjs scan <version|latest> <apk> <budget-seconds>
// Only `npx` fetches anything (the package from npm); this script makes no network request.
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FIXTURE_APP = 'dev.pragu.fixtures.rnshop';
const EXIT_ISSUES_FOUND = 1;
const EXIT_ENVIRONMENT = 3;
// npm can take a minute to serve a version that was just published.
const NPX_ATTEMPTS = 6;
const NPX_WAIT_MS = 20_000;

const VERSION_PATTERN = /^(latest|\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?)$/;

const failures = [];

function fail(message) {
  failures.push(message);
  console.log(`FAIL  ${message}`);
}

function pass(message) {
  console.log(`OK    ${message}`);
}

function check(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function pragu(version, args, cwd) {
  const started = performance.now();
  // Windows starts npx.cmd only through a shell.
  const result = spawnSync('npx', ['--yes', `pragu@${version}`, ...args], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const seconds = (performance.now() - started) / 1000;
  return { status: result.status, output, seconds };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The first call installs the package into npm's cache, so retry it while the registry catches up. */
function warmUp(version, cwd) {
  for (let attempt = 1; attempt <= NPX_ATTEMPTS; attempt++) {
    const result = pragu(version, ['--version'], cwd);
    if (result.status === 0) return result;
    console.log(`npx attempt ${String(attempt)}/${String(NPX_ATTEMPTS)} failed:\n${result.output}`);
    if (attempt < NPX_ATTEMPTS) sleep(NPX_WAIT_MS);
  }
  return undefined;
}

function emptyFolder() {
  return mkdtempSync(join(tmpdir(), 'pragu-quickstart-'));
}

function runCli(version) {
  const cwd = emptyFolder();
  console.log(`Empty folder: ${cwd}\nVersion: ${version}\n`);

  const first = warmUp(version, cwd);
  if (first === undefined) {
    fail(`npx pragu@${version} --version never succeeded`);
    return;
  }
  const printed = first.output.trim();
  console.log(`--version printed "${printed}" in ${first.seconds.toFixed(1)} s (includes the install)`);
  check(/^\d+\.\d+\.\d+/.test(printed), '--version prints a semantic version');
  if (version !== 'latest') check(printed === version, `--version equals the requested ${version}`);

  const rules = pragu(version, ['rules'], cwd);
  check(rules.status === 0, 'rules exits 0');
  check(/^\d+ rules\./m.test(rules.output), 'rules lists the rule count');
  check(rules.output.includes('name/interactive-missing'), 'rules lists name/interactive-missing');

  const init = pragu(version, ['init'], cwd);
  check(init.status === 0, 'init exits 0');
  check(existsSync(join(cwd, 'pragu.config.ts')), 'init writes pragu.config.ts');

  // No device is attached on a CI runner, so doctor must fail and say how to fix it.
  const doctor = pragu(version, ['doctor'], cwd);
  console.log(`\n--- doctor output (exit ${String(doctor.status)}) ---\n${doctor.output}---`);
  check(doctor.status === EXIT_ENVIRONMENT, `doctor exits ${String(EXIT_ENVIRONMENT)} (environment error)`);
  check(doctor.output.includes('PROBLEM'), 'doctor reports a PROBLEM');
  check(doctor.output.includes('No Android device or emulator is connected.'), 'doctor names the missing device');
  check(doctor.output.includes('Fix: Start an emulator'), 'doctor prints the fix for the missing device');
  // Known starter-config bug: `init` writes `import ... from 'pragu'`, which npx alone does not
  // resolve. Reported loudly but not failing until the owner decides the fix.
  if (doctor.output.includes('Could not load pragu.config.ts')) {
    console.log(
      "KNOWN ISSUE  doctor also reports 'Could not load pragu.config.ts: Cannot find package pragu' in an npx-only folder (starter config imports 'pragu'). Not failing this job; the owner decides the fix.",
    );
  }
}

function runScan(version, apk, budgetText) {
  const budget = Number(budgetText);
  if (!Number.isFinite(budget) || budget <= 0) {
    fail(`budget-seconds must be a positive number, not "${budgetText}"`);
    return;
  }
  const apkPath = resolve(apk);
  if (!existsSync(apkPath)) {
    fail(`APK not found: ${apkPath}`);
    return;
  }
  const cwd = emptyFolder();
  if (warmUp(version, cwd) === undefined) {
    fail(`npx pragu@${version} --version never succeeded`);
    return;
  }

  const scan = pragu(
    version,
    ['scan', '--install', apkPath, '--app', FIXTURE_APP, '--screen-name', 'Cart', '--out', join(cwd, 'pragu-report')],
    cwd,
  );
  console.log(
    `${scan.output}\nScan wall time: ${scan.seconds.toFixed(1)} s (budget ${String(budget)} s, package already cached)`,
  );
  // The fixture seeds barriers, so exit 1 is the success case. 0 would mean the scan saw nothing.
  check(scan.status === EXIT_ISSUES_FOUND, `scan exits ${String(EXIT_ISSUES_FOUND)} (barriers found in the fixture)`);
  check(existsSync(join(cwd, 'pragu-report')), 'scan writes the report folder');
  check(scan.seconds <= budget, `scan finished within ${String(budget)} s`);
}

const [mode, version, ...rest] = process.argv.slice(2);
if (!version || !['cli', 'scan'].includes(mode ?? '')) {
  console.error('Usage: quickstart-smoke.mjs cli <version> | scan <version> <apk> <budget-seconds>');
  process.exit(2);
}
if (!VERSION_PATTERN.test(version)) {
  console.error(`Not a version: "${version}". Use latest or X.Y.Z.`);
  process.exit(2);
}
if (mode === 'cli') runCli(version);
else runScan(version, rest[0] ?? '', rest[1] ?? '');

if (failures.length > 0) {
  console.log(`\n${String(failures.length)} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultRules } from '@pragu/core';
import { evaluate } from './evaluate.js';
import type { BenchResult } from './evaluate.js';
import { compareWithBaseline, errorRulesBelowBar } from './gate.js';
import { formatMetric } from './metrics.js';
import { recordAll } from './record.js';
import { loadFixtures, loadOutcomes } from './recordings.js';
import { renderMarkdown } from './report.js';
import { renderLabelPage } from './label.js';
import { loadRealApps, loadRealOutcomes, realRecordingFiles } from './real.js';
import type { Split } from './real.js';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

// Usage:
//   node bench/dist/cli.js evaluate [--update]                 score the recordings (CI runs this)
//   node bench/dist/cli.js evaluate --bar-only                  only check the 0.90 bar for error rules (other Android versions)
//   node bench/dist/cli.js evaluate --real dev|test [--update]  score the real-app bench (ADR-015; test only at releases)
//   node bench/dist/cli.js record-real --app <folder> --package <applicationId> --screen <id> [--large-text] [--serial <id>]
//                                                              record the screen on show for a real app, plus its labelling page
//   node bench/dist/cli.js record [--install] [--only <fixture>] [--serial <id>] [--budget-seconds <n>]   refresh recordings on a device

const root = fileURLToPath(new URL('../../', import.meta.url));
const resultsFile = join(root, 'bench', 'results.json');
const markdownFile = join(root, 'docs', 'bench', 'results.md');

function printTable(result: BenchResult): void {
  console.log(`Pragu Bench: ${String(result.screens)} screens from ${result.fixtures.join(', ')}`);
  for (const rule of result.rules) {
    console.log(
      `  ${rule.rule.padEnd(26)} TP ${String(rule.tp).padStart(2)}  FP ${String(rule.fp).padStart(2)}  FN ${String(rule.fn).padStart(2)}  TN ${String(rule.tn).padStart(2)}  precision ${formatMetric(rule.precision)}  recall ${formatMetric(rule.recall)}`,
    );
  }
}

async function evaluateCommand(update: boolean, barOnly: boolean): Promise<number> {
  const outcomes = await loadOutcomes(root, await loadFixtures(root));
  const result = evaluate(
    outcomes,
    defaultRules.map((rule) => ({ id: rule.meta.id, severity: rule.meta.severity })),
  );
  printTable(result);
  for (const rule of errorRulesBelowBar(result)) {
    console.log(
      `Below the bar: ${rule.rule} has precision ${formatMetric(rule.precision)}; error rules need 0.90 by the end of M1.`,
    );
  }
  // Another Android version renders differently, so exact equality with the published table
  // would fail for no reason; what must hold everywhere is the precision bar (D-25).
  // A rule that reports nothing raises no false alarm, so it does not fail this check; it is
  // still named, as a GitHub warning, because missing every barrier is worth knowing.
  if (barOnly) {
    const below = errorRulesBelowBar(result).filter((rule) => rule.precision !== null);
    for (const rule of result.rules.filter((candidate) => candidate.precision === null && candidate.fn > 0)) {
      console.log(`::warning::${rule.rule} found none of its ${String(rule.fn)} barriers on this Android version.`);
    }
    console.log(
      below.length === 0
        ? 'No error rule raises false alarms beyond the 0.90 bar.'
        : 'An error rule is below the 0.90 bar.',
    );
    return below.length === 0 ? 0 : 1;
  }
  if (update) {
    await writeFile(resultsFile, `${JSON.stringify(result, null, 2)}\n`);
    await mkdir(dirname(markdownFile), { recursive: true });
    await writeFile(markdownFile, renderMarkdown(result));
    console.log('Updated bench/results.json and docs/bench/results.md.');
    return 0;
  }
  const baseline = existsSync(resultsFile) ? (JSON.parse(await readFile(resultsFile, 'utf8')) as BenchResult) : null;
  const gate = compareWithBaseline(result, baseline);
  for (const message of gate.messages) console.log(message);
  console.log(gate.ok ? 'Bench matches the published results.' : 'Bench differs from the published results.');
  return gate.ok ? 0 : 1;
}

const RULE_IDS = defaultRules.map((rule) => rule.meta.id);

/** Scores one half of the real-app bench. The test half is for releases only (ADR-015). */
async function evaluateReal(split: Split, update: boolean): Promise<number> {
  const apps = await loadRealApps(root, split);
  if (apps.length === 0) {
    console.log(`No real apps are labelled in the ${split} set yet (bench/real/<app>/expected.json).`);
    return 0;
  }
  const result = evaluate(
    await loadRealOutcomes(root, apps),
    defaultRules.map((rule) => ({ id: rule.meta.id, severity: rule.meta.severity })),
  );
  printTable(result);
  if (update) {
    const file = join(root, 'bench', 'real', `results-${split}.json`);
    await writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Updated ${file}.`);
  }
  return 0;
}

/**
 * Captures the screen on show with the real CLI and keeps it as a real-app recording, with
 * a labelling page next to it. Navigating to the screen is done by hand, on purpose: real
 * apps have no deep links into every screen, and a person checks that it is the right one.
 */
async function recordReal(
  app: string,
  appId: string,
  screenId: string,
  largeText: boolean,
  serial: string | undefined,
): Promise<void> {
  const out = await mkdtemp(join(tmpdir(), 'pragu-real-'));
  try {
    const args = [
      join(root, 'packages', 'cli', 'dist', 'bin.js'),
      'scan',
      '--no-launch',
      '--screen-name',
      screenId,
      '--out',
      out,
      '--fail-on',
      'never',
    ];
    if (largeText) args.push('--check-font-scale');
    if (serial !== undefined) args.push('--serial', serial);
    await promisify(execFile)(process.execPath, [...args, '--app', appId], { timeout: 180_000, windowsHide: true });
    const files = realRecordingFiles(root, app, screenId);
    await mkdir(dirname(files.json), { recursive: true });
    const capture = join(out, 'capture');
    await copyFile(join(capture, 'screen-1.json'), files.json);
    await copyFile(join(capture, 'screen-1.png'), files.png);
    if (existsSync(join(capture, 'screen-1-large-text.json')))
      await copyFile(join(capture, 'screen-1-large-text.json'), files.largeTextJson);
    const page = files.json.replace(/\.json$/, '.label.html');
    await writeFile(
      page,
      renderLabelPage(
        JSON.parse(await readFile(files.json, 'utf8')),
        await readFile(files.png),
        { id: screenId, name: screenId },
        RULE_IDS,
      ),
    );
    console.log(`Recorded ${files.json}\nLabel it blind in ${page}`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

function budgetFrom(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error(`--budget-seconds must be a positive number, not "${value}".`);
  return seconds;
}

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const [command = 'evaluate', ...args] = process.argv.slice(2);
try {
  const real = valueAfter(args, '--real');
  if (command === 'evaluate' && real !== undefined) {
    if (real !== 'dev' && real !== 'test') throw new Error('--real must be "dev" or "test".');
    process.exitCode = await evaluateReal(real, args.includes('--update'));
  } else if (command === 'evaluate') {
    process.exitCode = await evaluateCommand(args.includes('--update'), args.includes('--bar-only'));
  } else if (command === 'record-real') {
    const app = valueAfter(args, '--app');
    const appId = valueAfter(args, '--package');
    const screen = valueAfter(args, '--screen');
    if (app === undefined || appId === undefined || screen === undefined) {
      throw new Error('record-real needs --app <folder>, --package <applicationId> and --screen <id>.');
    }
    await recordReal(app, appId, screen, args.includes('--large-text'), valueAfter(args, '--serial'));
  } else if (command === 'record') {
    const options = {
      install: args.includes('--install'),
      only: valueAfter(args, '--only'),
      serial: valueAfter(args, '--serial'),
      budgetSeconds: budgetFrom(valueAfter(args, '--budget-seconds')),
    };
    await recordAll(root, options, (line) => {
      console.log(line);
    });
  } else {
    console.error(
      `Unknown command "${command}". Use "evaluate [--update | --bar-only]" or "record [--install] [--only <fixture>] [--serial <id>] [--budget-seconds <n>]".`,
    );
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`pragu-bench: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 3;
}

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

// Usage:
//   node bench/dist/cli.js evaluate [--update]                 score the recordings (CI runs this)
//   node bench/dist/cli.js record [--install] [--only <fixture>] [--serial <id>]   refresh recordings on a device

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

async function evaluateCommand(update: boolean): Promise<number> {
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

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const [command = 'evaluate', ...args] = process.argv.slice(2);
try {
  if (command === 'evaluate') {
    process.exitCode = await evaluateCommand(args.includes('--update'));
  } else if (command === 'record') {
    const options = {
      install: args.includes('--install'),
      only: valueAfter(args, '--only'),
      serial: valueAfter(args, '--serial'),
    };
    await recordAll(root, options, (line) => {
      console.log(line);
    });
  } else {
    console.error(
      `Unknown command "${command}". Use "evaluate [--update]" or "record [--install] [--only <fixture>] [--serial <id>]".`,
    );
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`pragu-bench: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 3;
}

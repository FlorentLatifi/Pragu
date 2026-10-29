import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createBaseline, parseBaseline } from '@pragu/core';
import type { Baseline, ScanResult } from '@pragu/core';
import { EXIT, PraguError } from './errors.js';
import type { Io } from './main.js';

export const DEFAULT_BASELINE = 'pragu-baseline.json';

/** Reads a baseline for a scan; a missing or broken file is a usage error with the way out. */
export async function readBaseline(file: string): Promise<Baseline> {
  if (!existsSync(file)) {
    throw new PraguError(
      EXIT.usage,
      `The baseline ${file} was not found.`,
      'Create one from a scan: pragu baseline create --from pragu-report/pragu-result.json',
    );
  }
  try {
    return parseBaseline(JSON.parse(await readFile(file, 'utf8')), file);
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      'Recreate it with "pragu baseline update --from <pragu-result.json>".',
    );
  }
}

async function readResult(file: string): Promise<ScanResult> {
  if (!existsSync(file)) {
    throw new PraguError(
      EXIT.usage,
      `The scan result ${file} was not found.`,
      'Run "pragu scan" first; it writes pragu-result.json.',
    );
  }
  return JSON.parse(await readFile(file, 'utf8')) as ScanResult;
}

/**
 * pragu baseline create|update --from <pragu-result.json> [--out <file>]: accepts every
 * issue of a scan. "create" refuses to overwrite, so replacing a baseline is a deliberate "update".
 */
export async function runBaseline(args: string[], io: Io, now: () => Date = () => new Date()): Promise<number> {
  const [action, ...rest] = args;
  if (action !== 'create' && action !== 'update') {
    throw new PraguError(
      EXIT.usage,
      'Use "pragu baseline create" or "pragu baseline update".',
      'Example: pragu baseline create --from pragu-report/pragu-result.json',
    );
  }
  let values: { from?: string; out?: string };
  try {
    values = parseArgs({
      args: rest,
      strict: true,
      options: { from: { type: 'string' }, out: { type: 'string' } },
    }).values;
  } catch (error) {
    throw new PraguError(EXIT.usage, error instanceof Error ? error.message : String(error), 'Run "pragu --help".');
  }
  if (values.from === undefined) {
    throw new PraguError(EXIT.usage, 'Tell Pragu which scan to accept.', 'Add --from <pragu-result.json>.');
  }
  const out = values.out ?? DEFAULT_BASELINE;
  if (action === 'create' && existsSync(out)) {
    throw new PraguError(EXIT.usage, `${out} already exists.`, 'Use "pragu baseline update" to replace it on purpose.');
  }
  const baseline = createBaseline(await readResult(values.from), now().toISOString());
  await writeFile(out, `${JSON.stringify(baseline, null, 2)}\n`);
  const count = baseline.issues.length;
  io.out(
    `Wrote ${out}: ${String(count)} accepted ${count === 1 ? 'issue' : 'issues'}. Commit it; scans with --baseline ${out} now fail only on new issues.\n`,
  );
  return EXIT.ok;
}

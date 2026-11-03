import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RESULT_SCHEMA_VERSION } from '@pragu/core';
import type { ReportScreenshot } from '@pragu/report';
import { renderReport } from '@pragu/report';
import { readResult } from './baseline.js';
import { EXIT, PraguError } from './errors.js';
import { reportScreenshot } from './screenshot.js';
import type { Io } from './main.js';

/**
 * pragu report <pragu-result.json> [--out <file>]: renders the HTML report again from a
 * scan's result, with the screenshots the scan kept next to it. Rules do not run again;
 * that is --from-capture.
 */
export async function runReport(args: string[], io: Io): Promise<number> {
  let parsed: { positionals: string[]; values: { out?: string } };
  try {
    parsed = parseArgs({ args, strict: true, allowPositionals: true, options: { out: { type: 'string' } } });
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      'Use "pragu report pragu-report/pragu-result.json".',
    );
  }
  const [file, ...extra] = parsed.positionals;
  if (file === undefined || extra.length > 0) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which scan result to render.',
      'Use "pragu report pragu-report/pragu-result.json".',
    );
  }
  const result = await readResult(file);
  if (result.schemaVersion !== RESULT_SCHEMA_VERSION) {
    throw new PraguError(
      EXIT.usage,
      `${file} uses result schema ${result.schemaVersion}; this Pragu renders ${RESULT_SCHEMA_VERSION}.`,
      'Analyse the saved captures again: pragu scan --from-capture <scan folder>/capture/screens.json',
    );
  }
  const screenshots = new Map<string, ReportScreenshot>();
  for (const screen of result.screens) {
    if (screen.screenshot === null) continue;
    const path = resolve(dirname(file), screen.screenshot.file);
    if (!existsSync(path)) {
      io.err(`The screenshot ${path} is missing; the report shows ${screen.name} without it.\n`);
      continue;
    }
    screenshots.set(screen.id, reportScreenshot(await readFile(path)));
  }
  const out = parsed.values.out ?? join(dirname(file), 'pragu-report.html');
  await writeFile(out, renderReport({ result, screenshots }));
  io.out(`Report: ${out}\n`);
  return EXIT.ok;
}

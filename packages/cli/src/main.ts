import { parseArgs } from 'node:util';
import type { Issue } from '@pragu/core';
import { EXIT, PraguError, formatError } from './errors.js';
import { scan } from './scan.js';
import type { FailOn } from './scan.js';
import { toolVersion } from './version.js';

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

const defaultIo: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

const HELP = `Pragu finds accessibility barriers in your mobile app.

Usage
  pragu scan --app <applicationId> [options]
  pragu --version

Scan options
  --app <id>             Application id to launch and scan, e.g. com.example.shop
  --out <dir>            Where to write the report and JSON (default: pragu-report)
  --serial <id>          Device to use when several are connected (see "adb devices")
  --install <apk>        Install this APK before scanning
  --screen-name <name>   Name for the screen in the report
  --fail-on <level>      Exit 1 on issues at this severity or worse: error, warning, info, never (default: error)
  --no-launch            Scan whatever is on screen instead of launching the app
  --check-font-scale     Also capture at 200% text to find text that is cut off; changes the
                         device's font size for a few seconds and always restores it
  --from-capture <json>  Re-analyse a capture saved by an earlier scan, without a device
  --agent-apk <path>     Use this agent APK instead of the bundled one

Exit codes
  0 no issues at the threshold · 1 issues found · 2 usage error · 3 environment error

Automated checks find some barriers, not all. Pragu never certifies compliance.
`;

const PLANNED = new Set(['init', 'doctor', 'report', 'baseline', 'rules']);
const FAIL_ON: readonly FailOn[] = ['error', 'warning', 'info', 'never'];

function parseScanArgs(args: string[]) {
  try {
    return parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        app: { type: 'string' },
        out: { type: 'string', default: 'pragu-report' },
        serial: { type: 'string' },
        install: { type: 'string' },
        'screen-name': { type: 'string' },
        'fail-on': { type: 'string', default: 'error' },
        'no-launch': { type: 'boolean', default: false },
        'check-font-scale': { type: 'boolean', default: false },
        'from-capture': { type: 'string' },
        'agent-apk': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }).values;
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      'Run "pragu scan --help".',
    );
  }
}

function describeIssue(issue: Issue, index: number): string {
  const label = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
  const where = issue.resourceId === null ? '' : ` · ${issue.resourceId}`;
  return `  ${String(index + 1)}. ${label}: ${issue.title}${where} (WCAG ${issue.wcag.join(', ')})\n`;
}

async function runScan(args: string[], io: Io): Promise<number> {
  const values = parseScanArgs(args);
  if (values.help) {
    io.out(HELP);
    return EXIT.ok;
  }
  const failOn = values['fail-on'] as FailOn;
  if (!FAIL_ON.includes(failOn)) {
    throw new PraguError(EXIT.usage, `--fail-on must be one of ${FAIL_ON.join(', ')}.`);
  }
  if (values.app === undefined && values['from-capture'] === undefined) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which app to scan.',
      'Add --app <applicationId>, e.g. --app com.example.shop.',
    );
  }

  const outcome = await scan(
    {
      appId: values.app,
      outDir: values.out,
      serial: values.serial,
      installApk: values.install,
      agentApk: values['agent-apk'],
      screenName: values['screen-name'],
      failOn,
      fromCapture: values['from-capture'],
      launch: !values['no-launch'],
      checkFontScale: values['check-font-scale'],
    },
    (line) => {
      io.err(`${line}\n`);
    },
  );

  const { result } = outcome;
  const { errors, warnings, infos } = result.summary;
  const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;
  io.out(`\nPragu scanned ${result.app.id} on ${result.device.model} (Android ${result.device.osVersion})\n`);
  io.out(
    `${count(result.issues.length, 'barrier', 'barriers')}: ${count(errors, 'error', 'errors')}, ${count(warnings, 'warning', 'warnings')}, ${String(infos)} info\n`,
  );
  result.issues.forEach((issue, index) => {
    io.out(describeIssue(issue, index));
  });
  io.out(`Report: ${outcome.reportFile}\nJSON:   ${outcome.resultFile}\n`);
  return outcome.exitCode;
}

export async function main(argv: string[], io: Io = defaultIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
      io.out(HELP);
      return EXIT.ok;
    }
    if (command === '--version' || command === '-v') {
      io.out(`${toolVersion()}\n`);
      return EXIT.ok;
    }
    if (command === 'scan') return await runScan(rest, io);
    if (PLANNED.has(command)) {
      throw new PraguError(
        EXIT.usage,
        `"pragu ${command}" is planned for M1 and is not available yet.`,
        'Run "pragu --help" for what works today.',
      );
    }
    throw new PraguError(EXIT.usage, `Unknown command "${command}".`, 'Run "pragu --help" to see the commands.');
  } catch (error) {
    const { text, exitCode } = formatError(error);
    io.err(text);
    return exitCode;
  }
}

import { parseArgs } from 'node:util';
import type { Issue, ScreenConfig } from '@pragu/core';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { Adb, findAdb } from './adb.js';
import { runBaseline } from './baseline.js';
import { syncedFolderWarning } from './cloud.js';
import { runComment } from './comment.js';
import { writeSarif } from './locate.js';
import { initConfig, initWorkflow, loadConfig } from './config.js';
import { formatChecks, runDoctor } from './doctor.js';
import { runReport } from './report.js';
import { runRules } from './rules.js';
import { EXIT, PraguError, formatError } from './errors.js';
import { agentApkPath, scan } from './scan.js';
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
  pragu init [--github]    Write a starter pragu.config.ts, and with --github a GitHub Actions workflow
  pragu doctor             Check Node, adb, the device and the agent, with exact fixes
  pragu rules [--explain <id>]
                           List what Pragu checks, or explain one rule and its fixes
  pragu report <pragu-result.json> [--out <file>]
                           Render the HTML report again from a scan's result
  pragu comment <pragu-result.json> [--base <main-result.json>] [--report-url <url>] [--out <file>]
                           Write the pull-request comment: only the barriers this change adds
  pragu baseline create|update --from <pragu-result.json> [--out <file>]
                           Accept a scan's issues, so later scans fail only on new ones
  pragu --version

Scan options
  --app <id>             Application id to launch and scan, e.g. com.example.shop
  --screen <name>        Scan only this screen from the "screens" in pragu.config.ts
  --config <file>        Use this config instead of pragu.config.ts in this folder
  --baseline <file>      Fail only on issues that are not in this baseline
  --out <dir>            Where to write the report and JSON (default: pragu-report)
  --serial <id>          Device to use when several are connected (see "adb devices")
  --install <apk>        Install this APK before scanning
  --screen-name <name>   Name for the screen in the report, when no screens are configured
  --fail-on <level>      Exit 1 on issues at this severity or worse: error, warning, info, never (default: error)

Flags win over pragu.config.ts, which wins over the defaults. With "screens" in the config
(name and deep link each), Pragu opens every screen on a fresh start and checks it.
  --no-launch            Scan whatever is on screen instead of launching the app
  --check-font-scale     Also capture at 200% text to find text that is cut off; changes the
                         device's font size for a few seconds and always restores it
  --from-capture <json>  Re-analyse a capture saved by an earlier scan, without a device
  --agent-apk <path>     Use this agent APK instead of the bundled one
  --verbose              Print each adb command and agent request with its duration
  --format <list>        Also write SARIF for code scanning: --format sarif (HTML and JSON are always written)
  --redact               Write a report for sharing: the app's text covered in screenshots and
                         replaced in names, quotes and the JSON; no raw captures are kept

Exit codes
  0 no issues at the threshold · 1 issues found · 2 usage error · 3 environment error

Automated checks find some barriers, not all. Pragu never certifies compliance.
`;

const FAIL_ON: readonly FailOn[] = ['error', 'warning', 'info', 'never'];

function parseScanArgs(args: string[]) {
  try {
    return parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        app: { type: 'string' },
        out: { type: 'string' },
        config: { type: 'string' },
        baseline: { type: 'string' },
        serial: { type: 'string' },
        install: { type: 'string' },
        screen: { type: 'string' },
        'screen-name': { type: 'string' },
        'fail-on': { type: 'string' },
        'no-launch': { type: 'boolean', default: false },
        'check-font-scale': { type: 'boolean', default: false },
        'from-capture': { type: 'string' },
        'agent-apk': { type: 'string' },
        verbose: { type: 'boolean', default: false },
        redact: { type: 'boolean', default: false },
        format: { type: 'string' },
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

type ScanValues = ReturnType<typeof parseScanArgs>;

/** The configured screens a scan opens: all of them, the one --screen names, or none when scanning what is on show. */
function chooseScreens(
  configured: readonly ScreenConfig[] | undefined,
  values: ScanValues,
): ScreenConfig[] | undefined {
  const onShow = values['no-launch'] || values['from-capture'] !== undefined;
  const wanted = values.screen;
  if (wanted !== undefined) {
    if (onShow) {
      throw new PraguError(
        EXIT.usage,
        '--screen opens a screen from pragu.config.ts, so it cannot be combined with --no-launch or --from-capture.',
        'Leave out one of them.',
      );
    }
    const match = configured?.find((screen) => screen.name === wanted);
    if (match !== undefined) return [match];
    throw new PraguError(
      EXIT.usage,
      configured === undefined
        ? `--screen "${wanted}": pragu.config.ts lists no screens.`
        : `--screen "${wanted}" is not one of the screens in pragu.config.ts.`,
      configured === undefined
        ? 'Add screens: [{ name, deepLink }] to pragu.config.ts, or leave out --screen.'
        : `Known screens: ${configured.map((screen) => screen.name).join(', ')}.`,
    );
  }
  if (onShow || configured === undefined) return undefined;
  if (values['screen-name'] !== undefined) {
    throw new PraguError(
      EXIT.usage,
      '--screen-name names a single screen, but pragu.config.ts lists screens with their own names.',
      'Use --screen <name> to scan one of them, or --no-launch to scan what is on show.',
    );
  }
  return [...configured];
}

function describeIssue(issue: Issue, index: number): string {
  const label = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
  const where = issue.resourceId === null ? '' : ` · ${issue.resourceId}`;
  return `  ${String(index + 1)}. ${label}: ${issue.title}${where} (${issue.wcag.length === 0 ? 'best practice' : `WCAG ${issue.wcag.join(', ')}`})\n`;
}

async function runScan(args: string[], io: Io): Promise<number> {
  const values = parseScanArgs(args);
  if (values.help) {
    io.out(HELP);
    return EXIT.ok;
  }
  const { config, file: configFile } = await loadConfig(process.cwd(), values.config);
  const formats = new Set((values.format ?? 'html,json').split(',').map((format) => format.trim()));
  const unknownFormat = [...formats].find((format) => !['html', 'json', 'sarif'].includes(format));
  if (unknownFormat !== undefined) {
    throw new PraguError(
      EXIT.usage,
      `--format does not know "${unknownFormat}".`,
      'Use html, json and sarif, e.g. --format html,json,sarif.',
    );
  }
  const failOn = (values['fail-on'] ?? config.failOn ?? 'error') as FailOn;
  if (!FAIL_ON.includes(failOn)) {
    throw new PraguError(EXIT.usage, `--fail-on must be one of ${FAIL_ON.join(', ')}.`);
  }
  const screens = chooseScreens(config.screens, values);
  if (values['no-launch'] && config.screens !== undefined) {
    io.err('Scanning what is on show (--no-launch); the screens in pragu.config.ts are not opened.\n');
  }
  const appId = values.app ?? config.app;
  if (appId === undefined && values['from-capture'] === undefined) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which app to scan.',
      'Add --app <applicationId>, e.g. --app com.example.shop, or set "app" in pragu.config.ts.',
    );
  }

  const outDir = values.out ?? config.out ?? 'pragu-report';
  const synced = syncedFolderWarning(outDir);
  if (synced !== null) io.err(`${synced}\n`);

  const outcome = await scan(
    {
      appId,
      outDir,
      serial: values.serial,
      installApk: values.install,
      agentApk: values['agent-apk'],
      screenName: values['screen-name'],
      screens,
      failOn,
      fromCapture: values['from-capture'],
      launch: !values['no-launch'],
      checkFontScale: values['check-font-scale'] || config.checkFontScale === true,
      config,
      baselineFile: values.baseline ?? config.baseline,
      verbose: values.verbose,
      redact: values.redact || config.redact === true,
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
  if (result.score.value !== null) {
    io.out(`Pragu score: ${String(result.score.value)}/100 (automated checks; 100 does not mean accessible)\n`);
  }
  if (result.summary.baseline !== null) {
    const { newIssues, known, fixed } = result.summary.baseline;
    io.out(`Baseline: ${String(newIssues)} new, ${String(known)} already accepted, ${String(fixed)} fixed since\n`);
  }
  result.issues.forEach((issue, index) => {
    io.out(describeIssue(issue, index));
  });
  io.out(`Report: ${outcome.reportFile}\nJSON:   ${outcome.resultFile}\n`);
  if (formats.has('sarif')) {
    io.out(`SARIF:  ${await writeSarif(result, outDir, process.cwd(), configFile)}\n`);
  }
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
    if (command === 'baseline') return await runBaseline(rest, io);
    if (command === 'doctor') {
      const adbPath = findAdb();
      const adb = new Adb(adbPath);
      const agentApk = agentApkPath(undefined);
      const checks = await runDoctor({
        nodeVersion: process.versions.node,
        adb: (args) => adb.run(args),
        adbPath,
        agentApk,
        agentApkExists: existsSync(agentApk),
        checkConfig: async () => {
          const { file } = await loadConfig(process.cwd(), undefined);
          return file === null ? null : relative(process.cwd(), file);
        },
      });
      io.out(formatChecks(checks));
      return checks.every((check) => check.ok) ? EXIT.ok : EXIT.environment;
    }
    if (command === 'init') {
      const unknown = rest.filter((arg) => arg !== '--github');
      if (unknown.length > 0) {
        throw new PraguError(
          EXIT.usage,
          `Unknown option ${unknown.join(' ')}.`,
          'Use "pragu init" or "pragu init --github".',
        );
      }
      const file = await initConfig(process.cwd());
      io.out(`Wrote ${file}. Set "app" to your applicationId, then run "pragu scan".\n`);
      if (rest.includes('--github')) {
        const workflow = await initWorkflow(process.cwd());
        io.out(`Wrote ${workflow}. Add the step that builds your APK, and check the path given to --install.\n`);
      }
      return EXIT.ok;
    }
    if (command === 'rules') return runRules(rest, io);
    if (command === 'report') return await runReport(rest, io);
    if (command === 'comment') return await runComment(rest, io);
    throw new PraguError(EXIT.usage, `Unknown command "${command}".`, 'Run "pragu --help" to see the commands.');
  } catch (error) {
    const { text, exitCode } = formatError(error);
    io.err(text);
    return exitCode;
  }
}

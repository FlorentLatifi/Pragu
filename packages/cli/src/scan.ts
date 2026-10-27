import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESULT_SCHEMA_VERSION,
  analyze,
  defaultRules,
  normalizeAndroidCapture,
  parseAndroidCapture,
  summarize,
} from '@pragu/core';
import type { AndroidCapture, Issue, ScanResult, Severity } from '@pragu/core';
import { renderReport } from '@pragu/report';
import { PNG } from 'pngjs';
import { Adb, findAdb, selectDevice } from './adb.js';
import { AGENT_PACKAGE, startAgentSession } from './agent.js';
import { EXIT, PraguError } from './errors.js';
import { toolVersion } from './version.js';

export type FailOn = Severity | 'never';

export interface ScanOptions {
  appId: string | undefined;
  outDir: string;
  serial: string | undefined;
  installApk: string | undefined;
  agentApk: string | undefined;
  screenName: string | undefined;
  failOn: FailOn;
  fromCapture: string | undefined;
  launch: boolean;
}

export interface ScanOutcome {
  result: ScanResult;
  exitCode: number;
  resultFile: string;
  reportFile: string;
}

const SCREEN_ID = 'screen-1';
const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
// In the monorepo the CLI finds the agent APK that `pnpm agent:build` produced.
const DEV_AGENT_APK = fileURLToPath(
  new URL('../../../agents/android/agent/build/outputs/apk/release/agent-release.apk', import.meta.url),
);

export function exitCodeFor(issues: readonly Issue[], failOn: FailOn): number {
  if (failOn === 'never') return EXIT.ok;
  const threshold = SEVERITY_RANK[failOn];
  return issues.some((issue) => SEVERITY_RANK[issue.severity] <= threshold) ? EXIT.issuesFound : EXIT.ok;
}

interface RawScreen {
  capture: AndroidCapture;
  png: Buffer;
}

/** Captures one screen through the agent: launch the app, wait for it to settle, take tree and screenshot. */
async function captureFromDevice(options: ScanOptions, log: (line: string) => void): Promise<RawScreen> {
  if (options.appId === undefined) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which app to scan.',
      'Add --app <applicationId>, e.g. --app com.example.shop.',
    );
  }
  const appId = options.appId;
  const adb = new Adb(findAdb());
  const device = adb.withSerial(await selectDevice(adb, options.serial));

  if (options.installApk !== undefined) {
    if (!existsSync(options.installApk)) {
      throw new PraguError(
        EXIT.usage,
        `The APK to install was not found: ${options.installApk}`,
        'Build it first, e.g. "pnpm fixture:build".',
      );
    }
    log(`Installing ${options.installApk}`);
    await device.run(['install', '-r', options.installApk], 180_000);
  }

  const agentApk = options.agentApk ?? process.env.PRAGU_AGENT_APK ?? DEV_AGENT_APK;
  if (!existsSync(agentApk)) {
    throw new PraguError(
      EXIT.environment,
      `The Pragu agent APK was not found at ${agentApk}.`,
      'Build it with "pnpm agent:build".',
    );
  }
  await device.run(['install', '-r', agentApk], 120_000);

  if (options.launch) {
    const launched = await device.shell(['monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
    if (launched.includes('No activities found')) {
      throw new PraguError(
        EXIT.environment,
        `${appId} is not installed on ${device.serial ?? 'the device'}, or has no launcher screen.`,
        'Install it first, or pass --install <path-to-apk>.',
      );
    }
  }

  log(`Capturing ${appId} on ${device.serial ?? 'device'}`);
  const session = await startAgentSession(device);
  try {
    const frame = await session.request({ cmd: 'capture', packageName: appId, timeoutMs: 30_000 }, 45_000);
    const tree = frame.payloads.get('tree');
    const png = frame.payloads.get('screenshot');
    if (tree === undefined || png === undefined) {
      throw new PraguError(EXIT.environment, 'The agent answered without a tree or a screenshot.');
    }
    return { capture: parseAndroidCapture(JSON.parse(tree.toString('utf8'))), png };
  } finally {
    await session.close();
  }
}

async function captureFromFile(file: string): Promise<RawScreen> {
  const pngFile = file.replace(/\.json$/, '.png');
  if (!existsSync(file) || !existsSync(pngFile)) {
    throw new PraguError(
      EXIT.usage,
      `--from-capture needs ${file} and ${pngFile}.`,
      'Point it at a capture JSON written by an earlier scan.',
    );
  }
  return {
    capture: parseAndroidCapture(JSON.parse(await readFile(file, 'utf8'))),
    png: await readFile(pngFile),
  };
}

export async function scan(options: ScanOptions, log: (line: string) => void): Promise<ScanOutcome> {
  const startedAt = new Date().toISOString();
  const raw =
    options.fromCapture === undefined
      ? await captureFromDevice(options, log)
      : await captureFromFile(options.fromCapture);
  if (options.fromCapture === undefined && raw.capture.packageName === AGENT_PACKAGE) {
    throw new PraguError(
      EXIT.environment,
      'The agent captured itself instead of the app.',
      'Make sure the app is in the foreground.',
    );
  }

  const captureDir = join(options.outDir, 'capture');
  await mkdir(captureDir, { recursive: true });
  const screenshotFile = join(captureDir, `${SCREEN_ID}.png`);
  if (options.fromCapture === undefined) {
    await writeFile(join(captureDir, `${SCREEN_ID}.json`), `${JSON.stringify(raw.capture, null, 2)}\n`);
    await writeFile(screenshotFile, raw.png);
  }

  const { screen, device } = normalizeAndroidCapture(raw.capture, {
    screenId: SCREEN_ID,
    screenName: options.screenName ?? raw.capture.windowTitle ?? 'Screen 1',
    screenshotFile: relative(options.outDir, screenshotFile).replaceAll('\\', '/'),
  });
  const decoded = PNG.sync.read(raw.png);
  const issues = analyze({
    device,
    screens: [screen],
    rasters: new Map([[SCREEN_ID, { width: decoded.width, height: decoded.height, data: decoded.data }]]),
  });
  const result: ScanResult = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    tool: { name: 'pragu', version: toolVersion() },
    startedAt,
    device,
    app: { id: raw.capture.packageName },
    screens: [screen],
    issues,
    summary: summarize(issues, defaultRules),
  };

  const resultFile = join(options.outDir, 'pragu-result.json');
  const reportFile = join(options.outDir, 'pragu-report.html');
  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(
    reportFile,
    renderReport({
      result,
      screenshots: new Map([[SCREEN_ID, { mimeType: 'image/png', base64: raw.png.toString('base64') }]]),
    }),
  );
  return { result, exitCode: exitCodeFor(issues, options.failOn), resultFile, reportFile };
}

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
import type { AndroidCapture, Issue, PamScreen, ScanResult, Severity } from '@pragu/core';
import { renderReport } from '@pragu/report';
import { PNG } from 'pngjs';
import { Adb, findAdb, selectDevice } from './adb.js';
import { AGENT_PACKAGE, startAgentSession } from './agent.js';
import type { AgentSession } from './agent.js';
import { EXIT, PraguError } from './errors.js';
import { LARGE_TEXT_SCALE, withFontScale } from './font-scale.js';
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
  /** Capture the screen again at 200% text (text/scaling-truncation). Changes, then restores, the device's font scale. */
  checkFontScale: boolean;
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

interface RawCapture {
  capture: AndroidCapture;
  png: Buffer;
}

interface RawScreen extends RawCapture {
  /** The same screen at 200% text, when the scan asked for it. */
  largeText: LargeTextCapture | null;
}

/** The 200% capture; its screenshot is kept for people to look at, but no rule reads it. */
interface LargeTextCapture {
  capture: AndroidCapture;
  png: Buffer | null;
}

const LARGE_TEXT_SUFFIX = '-large-text';

async function captureOnce(session: AgentSession, appId: string): Promise<RawCapture> {
  const frame = await session.request({ cmd: 'capture', packageName: appId, timeoutMs: 30_000 }, 45_000);
  const tree = frame.payloads.get('tree');
  const png = frame.payloads.get('screenshot');
  if (tree === undefined || png === undefined) {
    throw new PraguError(EXIT.environment, 'The agent answered without a tree or a screenshot.');
  }
  return { capture: parseAndroidCapture(JSON.parse(tree.toString('utf8'))), png };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Apps lay text out again after the font scale changes; wait until the capture shows the new scale. */
async function captureAtScale(session: AgentSession, appId: string, scale: number): Promise<RawCapture> {
  for (const waitMs of [1_000, 1_500, 2_500]) {
    await delay(waitMs);
    const raw = await captureAfterSwitch(session, appId, scale);
    if (Math.abs(raw.capture.device.fontScale - scale) < 0.01) return raw;
  }
  throw new PraguError(
    EXIT.environment,
    `The device did not switch to font scale ${String(scale)}.`,
    'Check that the device allows changing system settings over adb, or scan without --check-font-scale.',
  );
}

/** Some apps crash or close when the text size changes; say that instead of a generic capture error. */
async function captureAfterSwitch(session: AgentSession, appId: string, scale: number): Promise<RawCapture> {
  try {
    return await captureOnce(session, appId);
  } catch (error) {
    if (!(error instanceof PraguError)) throw error;
    throw new PraguError(
      EXIT.environment,
      `${appId} left the screen when the text size changed to ${String(scale * 100)}%; it may have crashed. Your font size setting is restored.`,
      'Try the app with large text by hand, since a crash there is a barrier too. Scan without --check-font-scale to run the other checks.',
    );
  }
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
    const normal = await captureOnce(session, appId);
    if (!options.checkFontScale) return { ...normal, largeText: null };
    log(`Capturing again at ${String(LARGE_TEXT_SCALE * 100)}% text; your font size setting is restored afterwards`);
    const largeText = await withFontScale(device, LARGE_TEXT_SCALE, () =>
      captureAtScale(session, appId, LARGE_TEXT_SCALE),
    );
    return { ...normal, largeText };
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
  // A scan with --check-font-scale saved the 200% capture next to the first one.
  const largeFile = file.replace(/\.json$/, `${LARGE_TEXT_SUFFIX}.json`);
  const largePng = largeFile.replace(/\.json$/, '.png');
  const largeText = existsSync(largeFile)
    ? {
        capture: parseAndroidCapture(JSON.parse(await readFile(largeFile, 'utf8'))),
        png: existsSync(largePng) ? await readFile(largePng) : null,
      }
    : null;
  return {
    capture: parseAndroidCapture(JSON.parse(await readFile(file, 'utf8'))),
    png: await readFile(pngFile),
    largeText,
  };
}

function withLargeText(screen: PamScreen, largeText: LargeTextCapture | null): PamScreen {
  if (largeText === null) return screen;
  const large = normalizeAndroidCapture(largeText.capture, {
    screenId: screen.id,
    screenName: screen.name,
    screenshotFile: null,
  }).screen;
  return {
    ...screen,
    largeText: { fontScale: largeText.capture.device.fontScale, windows: large.windows, nodes: large.nodes },
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
    if (raw.largeText !== null) {
      const base = join(captureDir, `${SCREEN_ID}${LARGE_TEXT_SUFFIX}`);
      await writeFile(`${base}.json`, `${JSON.stringify(raw.largeText.capture, null, 2)}\n`);
      if (raw.largeText.png !== null) await writeFile(`${base}.png`, raw.largeText.png);
    }
  }

  const normalized = normalizeAndroidCapture(raw.capture, {
    screenId: SCREEN_ID,
    screenName: options.screenName ?? raw.capture.windowTitle ?? 'Screen 1',
    screenshotFile: relative(options.outDir, screenshotFile).replaceAll('\\', '/'),
  });
  const device = normalized.device;
  const screen = withLargeText(normalized.screen, raw.largeText);
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

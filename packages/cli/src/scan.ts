import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESULT_SCHEMA_VERSION,
  analyze,
  applyConfig,
  compareWithBaseline,
  enabledRules,
  normalizeAndroidCapture,
  parseAndroidCapture,
  summarize,
} from '@pragu/core';
import type {
  AndroidCapture,
  AndroidRawNode,
  FailOn,
  Issue,
  PamScreen,
  PraguConfig,
  ScanResult,
  ScreenConfig,
  Severity,
} from '@pragu/core';
import { renderReport } from '@pragu/report';
import { PNG } from 'pngjs';
import { Adb, findAdb, selectDevice } from './adb.js';
import { AGENT_PACKAGE, startAgentSession } from './agent.js';
import type { AgentSession } from './agent.js';
import { readBaseline } from './baseline.js';
import { EXIT, PraguError } from './errors.js';
import { LARGE_TEXT_SCALE, withFontScale } from './font-scale.js';
import { reportScreenshot } from './screenshot.js';
import { toolVersion } from './version.js';

export type { FailOn };

export interface ScanOptions {
  appId: string | undefined;
  outDir: string;
  serial: string | undefined;
  installApk: string | undefined;
  agentApk: string | undefined;
  /** Name of the one screen scanned when no screens are configured. */
  screenName: string | undefined;
  /** Screens from pragu.config.ts, each opened on a fresh start; undefined scans the screen on show. */
  screens: readonly ScreenConfig[] | undefined;
  failOn: FailOn;
  fromCapture: string | undefined;
  launch: boolean;
  /** Capture the screen again at 200% text (text/scaling-truncation). Changes, then restores, the device's font scale. */
  checkFontScale: boolean;
  /** Rule settings and ignores from pragu.config.ts. */
  config: PraguConfig;
  /** Accepted issues; only issues not in it fail the scan. */
  baselineFile: string | undefined;
  /** Log every adb command and agent request with its duration. */
  verbose: boolean;
}

export interface ScanOutcome {
  result: ScanResult;
  exitCode: number;
  resultFile: string;
  reportFile: string;
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
// In the monorepo the CLI finds the agent APK that `pnpm agent:build` produced.
const DEV_AGENT_APK = fileURLToPath(
  new URL('../../../agents/android/agent/build/outputs/apk/release/agent-release.apk', import.meta.url),
);
/** Lists the captured screens and their names, so --from-capture can re-run a whole scan. */
const SCREENS_FILE = 'screens.json';

/**
 * Installs the agent, replacing one signed with another key: every machine signs its own
 * build with its own debug key, so an agent left on a device by another machine cannot be
 * updated in place. The agent keeps no data, so reinstalling loses nothing.
 */
export async function installAgent(device: Pick<Adb, 'run'>, agentApk: string): Promise<void> {
  try {
    await device.run(['install', '-r', agentApk], 120_000);
  } catch (error) {
    if (!(error instanceof PraguError) || !error.message.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) throw error;
    await device.run(['uninstall', AGENT_PACKAGE], 60_000);
    await device.run(['install', agentApk], 120_000);
  }
}

/** The agent APK a scan installs: --agent-apk, then PRAGU_AGENT_APK, then the one built in this repo. */
export function agentApkPath(explicit: string | undefined): string {
  return explicit ?? process.env.PRAGU_AGENT_APK ?? DEV_AGENT_APK;
}

export function exitCodeFor(issues: readonly Issue[], failOn: FailOn): number {
  if (failOn === 'never') return EXIT.ok;
  const threshold = SEVERITY_RANK[failOn];
  return issues.some((issue) => SEVERITY_RANK[issue.severity] <= threshold) ? EXIT.issuesFound : EXIT.ok;
}

interface RawCapture {
  capture: AndroidCapture;
  png: Buffer;
}

/** The 200% capture; its screenshot is kept for people to look at, but no rule reads it. */
interface LargeTextCapture {
  capture: AndroidCapture;
  png: Buffer | null;
}

/** One captured screen, with the id and name it gets in the result. */
interface RawScreen extends RawCapture {
  id: string;
  name: string;
  /** The same screen at 200% text, when the scan asked for it. */
  largeText: LargeTextCapture | null;
}

const LARGE_TEXT_SUFFIX = '-large-text';

function screenId(index: number): string {
  return `screen-${String(index + 1)}`;
}

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

/** With --verbose: each agent request and how long the device took to answer. */
function traced(session: AgentSession, log: (line: string) => void): AgentSession {
  return {
    async request(command, timeoutMs) {
      const started = performance.now();
      try {
        return await session.request(command, timeoutMs);
      } finally {
        log(`agent ${String(command.cmd)} (${String(Math.round(performance.now() - started))} ms)`);
      }
    },
    close: () => session.close(),
  };
}

/** Resource ids match as given (React Native testID, Compose testTag) or after "package:id/" (Views). */
function hasResourceId(node: AndroidRawNode, id: string): boolean {
  return (
    node.resourceId === id ||
    node.resourceId?.endsWith(`:id/${id}`) === true ||
    node.children.some((child) => hasResourceId(child, id))
  );
}

/**
 * Captures a configured screen. With `waitFor`, it captures again until that element is
 * there, so a splash screen or a slow start is never checked under the screen's name.
 */
async function captureScreen(session: AgentSession, appId: string, screen: ScreenConfig): Promise<RawCapture> {
  const { waitFor } = screen;
  if (waitFor === undefined) return captureOnce(session, appId);
  for (const waitMs of [0, 1_000, 2_000, 4_000]) {
    await delay(waitMs);
    const raw = await captureOnce(session, appId);
    if (raw.capture.windows.some((window) => window.root !== null && hasResourceId(window.root, waitFor))) return raw;
  }
  throw new PraguError(
    EXIT.environment,
    `"${waitFor}" never appeared on the screen "${screen.name}".`,
    'Check that the deep link opens this screen and that one of its elements has this testID or resource id ("adb shell uiautomator dump" lists them).',
  );
}

/** Apps lay text out again after the font scale changes; wait until the capture shows the new scale. */
async function captureAtScale(
  session: AgentSession,
  appId: string,
  scale: number,
  screen: ScreenConfig | undefined,
): Promise<RawCapture> {
  for (const waitMs of [1_000, 1_500, 2_500]) {
    await delay(waitMs);
    const raw = await captureAfterSwitch(session, appId, scale, screen);
    if (Math.abs(raw.capture.device.fontScale - scale) < 0.01) return raw;
  }
  throw new PraguError(
    EXIT.environment,
    `The device did not switch to font scale ${String(scale)}.`,
    'Check that the device allows changing system settings over adb, or scan without --check-font-scale.',
  );
}

/** Some apps crash or close when the text size changes; say that instead of a generic capture error. */
async function captureAfterSwitch(
  session: AgentSession,
  appId: string,
  scale: number,
  screen: ScreenConfig | undefined,
): Promise<RawCapture> {
  try {
    return screen === undefined ? await captureOnce(session, appId) : await captureScreen(session, appId, screen);
  } catch (error) {
    if (!(error instanceof PraguError)) throw error;
    throw new PraguError(
      EXIT.environment,
      `${appId} left the screen when the text size changed to ${String(scale * 100)}%; it may have crashed. Your font size setting is restored.`,
      'Try the app with large text by hand, since a crash there is a barrier too. Scan without --check-font-scale to run the other checks.',
    );
  }
}

async function launchApp(device: Adb, appId: string): Promise<void> {
  const launched = await device.shell(['monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
  if (launched.includes('No activities found')) {
    throw new PraguError(
      EXIT.environment,
      `${appId} is not installed on ${device.serial ?? 'the device'}, or has no launcher screen.`,
      'Install it first, or pass --install <path-to-apk>.',
    );
  }
}

/** Opens a configured screen on a fresh app start: its deep link, or the app's launch screen. */
async function openScreen(device: Adb, appId: string, screen: ScreenConfig): Promise<void> {
  await device.shell(['am', 'force-stop', appId]);
  const { deepLink } = screen;
  if (deepLink === undefined) {
    await launchApp(device, appId);
    return;
  }
  const failure = new PraguError(
    EXIT.environment,
    `${appId} could not open ${deepLink} for the screen "${screen.name}".`,
    `Check that the app handles the link: adb shell am start -a android.intent.action.VIEW -d '${deepLink}' ${appId}`,
  );
  let output: string;
  try {
    // The device's shell would read ? and & in the link; the config refuses quotes, so single quotes are safe.
    output = await device.shell(
      ['am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `'${deepLink}'`, appId],
      60_000,
    );
  } catch {
    throw failure;
  }
  if (/^Error:/m.test(output)) throw failure;
}

/**
 * Opens and captures every configured screen in one agent session. With --check-font-scale
 * the font scale changes once, and every screen is opened again at 200%: quicker and steadier
 * than switching each running screen.
 */
async function captureScreens(
  device: Adb,
  session: AgentSession,
  appId: string,
  screens: readonly ScreenConfig[],
  checkFontScale: boolean,
  log: (line: string) => void,
): Promise<RawScreen[]> {
  const captured: { screen: ScreenConfig; raw: RawScreen }[] = [];
  for (const [index, screen] of screens.entries()) {
    log(`Capturing ${screen.name} (${String(index + 1)} of ${String(screens.length)})`);
    await openScreen(device, appId, screen);
    const normal = await captureScreen(session, appId, screen);
    captured.push({ screen, raw: { ...normal, id: screenId(index), name: screen.name, largeText: null } });
  }
  if (checkFontScale) {
    log(
      `Capturing every screen again at ${String(LARGE_TEXT_SCALE * 100)}% text; your font size setting is restored afterwards`,
    );
    await withFontScale(device, LARGE_TEXT_SCALE, async () => {
      for (const entry of captured) {
        await openScreen(device, appId, entry.screen);
        entry.raw.largeText = await captureAtScale(session, appId, LARGE_TEXT_SCALE, entry.screen);
      }
    });
  }
  return captured.map((entry) => entry.raw);
}

/** Captures the configured screens, or the one screen on show, through the agent. */
async function captureFromDevice(options: ScanOptions, log: (line: string) => void): Promise<RawScreen[]> {
  if (options.appId === undefined) {
    throw new PraguError(
      EXIT.usage,
      'Tell Pragu which app to scan.',
      'Add --app <applicationId>, e.g. --app com.example.shop.',
    );
  }
  const appId = options.appId;
  const adb = new Adb(findAdb(), null, options.verbose ? log : null);
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

  const agentApk = agentApkPath(options.agentApk);
  if (!existsSync(agentApk)) {
    throw new PraguError(
      EXIT.environment,
      `The Pragu agent APK was not found at ${agentApk}.`,
      'Build it with "pnpm agent:build".',
    );
  }
  await installAgent(device, agentApk);

  if (options.screens === undefined && options.launch) await launchApp(device, appId);

  log(`Capturing ${appId} on ${device.serial ?? 'device'}`);
  const agent = await startAgentSession(device);
  const session = options.verbose ? traced(agent, log) : agent;
  try {
    if (options.screens !== undefined) {
      return await captureScreens(device, session, appId, options.screens, options.checkFontScale, log);
    }
    const normal = await captureOnce(session, appId);
    const name = options.screenName ?? normal.capture.windowTitle ?? 'Screen 1';
    if (!options.checkFontScale) return [{ ...normal, id: screenId(0), name, largeText: null }];
    log(`Capturing again at ${String(LARGE_TEXT_SCALE * 100)}% text; your font size setting is restored afterwards`);
    const largeText = await withFontScale(device, LARGE_TEXT_SCALE, () =>
      captureAtScale(session, appId, LARGE_TEXT_SCALE, undefined),
    );
    return [{ ...normal, id: screenId(0), name, largeText }];
  } finally {
    await session.close();
  }
}

/** Reads one saved capture, with the 200% capture a scan with --check-font-scale saved next to it. */
async function readCapture(file: string): Promise<RawCapture & { largeText: LargeTextCapture | null }> {
  const pngFile = file.replace(/\.json$/, '.png');
  if (!existsSync(file) || !existsSync(pngFile)) {
    throw new PraguError(
      EXIT.usage,
      `--from-capture needs ${file} and ${pngFile}.`,
      'Point it at a capture JSON written by an earlier scan.',
    );
  }
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

interface ScreensFile {
  screens: { name: string; capture: string }[];
}

function isScreensFile(value: unknown): value is ScreensFile {
  if (typeof value !== 'object' || value === null || !('screens' in value)) return false;
  const { screens } = value;
  return (
    Array.isArray(screens) &&
    screens.length > 0 &&
    screens.every(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).name === 'string' &&
        typeof (entry as Record<string, unknown>).capture === 'string',
    )
  );
}

/** Re-reads a saved scan: one capture JSON, or the screens.json that lists a scan's screens. */
async function captureFromFile(file: string, screenName: string | undefined): Promise<RawScreen[]> {
  if (!existsSync(file)) {
    const pngFile = file.replace(/\.json$/, '.png');
    throw new PraguError(
      EXIT.usage,
      `--from-capture needs ${file} and ${pngFile}.`,
      'Point it at a capture JSON written by an earlier scan.',
    );
  }
  const content: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isScreensFile(content)) {
    const single = await readCapture(file);
    return [{ ...single, id: screenId(0), name: screenName ?? single.capture.windowTitle ?? 'Screen 1' }];
  }
  const screens: RawScreen[] = [];
  for (const [index, entry] of content.screens.entries()) {
    const raw = await readCapture(join(dirname(file), entry.capture));
    screens.push({ ...raw, id: screenId(index), name: entry.name });
  }
  return screens;
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

/** Keeps every capture next to the report, so the scan can be analysed again without a device. */
async function saveCaptures(captureDir: string, raws: readonly RawScreen[]): Promise<void> {
  await mkdir(captureDir, { recursive: true });
  for (const raw of raws) {
    await writeFile(join(captureDir, `${raw.id}.json`), `${JSON.stringify(raw.capture, null, 2)}\n`);
    await writeFile(join(captureDir, `${raw.id}.png`), raw.png);
    if (raw.largeText !== null) {
      const base = join(captureDir, `${raw.id}${LARGE_TEXT_SUFFIX}`);
      await writeFile(`${base}.json`, `${JSON.stringify(raw.largeText.capture, null, 2)}\n`);
      if (raw.largeText.png !== null) await writeFile(`${base}.png`, raw.largeText.png);
    }
  }
  const list: ScreensFile = { screens: raws.map((raw) => ({ name: raw.name, capture: `${raw.id}.json` })) };
  await writeFile(join(captureDir, SCREENS_FILE), `${JSON.stringify(list, null, 2)}\n`);
}

export async function scan(options: ScanOptions, log: (line: string) => void): Promise<ScanOutcome> {
  const startedAt = new Date().toISOString();
  const raws =
    options.fromCapture === undefined
      ? await captureFromDevice(options, log)
      : await captureFromFile(options.fromCapture, options.screenName);
  if (options.fromCapture === undefined && raws.some((raw) => raw.capture.packageName === AGENT_PACKAGE)) {
    throw new PraguError(
      EXIT.environment,
      'The agent captured itself instead of the app.',
      'Make sure the app is in the foreground.',
    );
  }

  const captureDir = join(options.outDir, 'capture');
  await saveCaptures(captureDir, raws);

  const prepared = raws.map((raw) => {
    const normalized = normalizeAndroidCapture(raw.capture, {
      screenId: raw.id,
      screenName: raw.name,
      screenshotFile: relative(options.outDir, join(captureDir, `${raw.id}.png`)).replaceAll('\\', '/'),
    });
    const decoded = PNG.sync.read(raw.png);
    return {
      raw,
      device: normalized.device,
      screen: withLargeText(normalized.screen, raw.largeText),
      raster: { width: decoded.width, height: decoded.height, data: decoded.data },
    };
  });
  const first = prepared[0];
  if (first === undefined) throw new Error('A scan always captures at least one screen.');
  const { device } = first;
  const screens = prepared.map((entry) => entry.screen);
  const rules = enabledRules(options.config);
  const found = analyze({
    device,
    screens,
    rasters: new Map(prepared.map((entry) => [entry.raw.id, entry.raster])),
    rules,
  });
  const configured = applyConfig(found, options.config, new Map(screens.map((screen) => [screen.id, screen.name])));
  const baseline = options.baselineFile === undefined ? null : await readBaseline(options.baselineFile);
  const compared = baseline === null ? null : compareWithBaseline(configured.issues, screens, baseline);
  const issues = compared?.issues ?? configured.issues;
  const summary = summarize(issues, rules, configured.ignored.length);
  if (compared !== null && options.baselineFile !== undefined) {
    summary.baseline = { file: options.baselineFile, ...compared.comparison };
  }
  const result: ScanResult = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    tool: { name: 'pragu', version: toolVersion() },
    startedAt,
    device,
    app: { id: first.raw.capture.packageName },
    screens,
    issues,
    summary,
  };

  const resultFile = join(options.outDir, 'pragu-result.json');
  const reportFile = join(options.outDir, 'pragu-report.html');
  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(
    reportFile,
    renderReport({
      result,
      screenshots: new Map(prepared.map((entry) => [entry.raw.id, reportScreenshot(entry.raw.png)])),
    }),
  );
  // With a baseline, only new issues can fail the build.
  const failing = issues.filter((issue) => !issue.inBaseline);
  return { result, exitCode: exitCodeFor(failing, options.failOn), resultFile, reportFile };
}

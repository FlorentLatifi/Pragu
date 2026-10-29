import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { parseAndroidCapture } from '@pragu/core';
import { PNG } from 'pngjs';
import type { AndroidRawNode } from '@pragu/core';
import { loadFixtures, recordingFiles } from './recordings.js';
import type { GroundTruth, TruthScreen } from './truth.js';

const run = promisify(execFile);
const ATTEMPTS = 2;

function adbExecutable(): string {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const candidate =
    sdk === undefined ? '' : join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return candidate !== '' && existsSync(candidate) ? candidate : 'adb';
}

export function containsResourceId(node: AndroidRawNode, resourceId: string): boolean {
  return node.resourceId === resourceId || node.children.some((child) => containsResourceId(child, resourceId));
}

export interface RecordOptions {
  /** Install each fixture's release APK first. */
  install: boolean;
  /** Record one fixture only, leaving the others' recordings untouched. */
  only: string | undefined;
  serial: string | undefined;
}

type Adb = (args: string[]) => Promise<unknown>;

/** A screenshot of one colour means the device drew nothing; recording it would poison the bench. */
export function isBlank(png: Buffer): boolean {
  const { data } = PNG.sync.read(png);
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) return false;
  }
  return true;
}

/** 200%, as WCAG 1.4.4 asks. */
const LARGE_TEXT_SCALE = '2.0';

/**
 * Opens a labelled screen by deep link on a fresh app start, scans it with the real CLI
 * and copies the capture with `keep`. A capture without the screen's marker is retried,
 * so a slow start can never be recorded as the wrong screen.
 */
async function recordScreen(
  context: { adb: Adb; cli: string; serialArgs: string[]; log: (line: string) => void },
  truth: GroundTruth,
  screen: TruthScreen,
  keep: (captureDir: string) => Promise<void>,
): Promise<void> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    await context.adb(['shell', 'am', 'force-stop', truth.appId]);
    // adb hands the command to the device's shell, which would treat ? and & in a deep link specially.
    const url = `'${screen.url.replaceAll("'", '')}'`;
    await context.adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, truth.appId]);
    const out = await mkdtemp(join(tmpdir(), 'pragu-bench-'));
    try {
      const scanArgs = ['scan', '--app', truth.appId, '--no-launch', '--screen-name', screen.name];
      await run(
        process.execPath,
        [context.cli, ...scanArgs, '--out', out, '--fail-on', 'never', ...context.serialArgs],
        {
          timeout: 180_000,
          windowsHide: true,
        },
      );
      const captureDir = join(out, 'capture');
      const capture = parseAndroidCapture(JSON.parse(await readFile(join(captureDir, 'screen-1.json'), 'utf8')));
      const showsMarker = capture.windows.some(
        (window) => window.root !== null && containsResourceId(window.root, screen.marker),
      );
      const png = await readFile(join(captureDir, 'screen-1.png'));
      if (showsMarker && isBlank(png)) {
        throw new Error(
          `The screenshot of ${truth.fixture} › ${screen.id} is a single colour: the emulator's graphics have failed. Cold-boot it (-no-snapshot-load) and record again.`,
        );
      }
      if (showsMarker) {
        await keep(captureDir);
        return;
      }
      context.log(
        `${truth.fixture} › ${screen.id}: marker "${screen.marker}" not on screen yet (attempt ${String(attempt)})`,
      );
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  }
  throw new Error(`Could not record ${truth.fixture} › ${screen.id}: the marker "${screen.marker}" never appeared.`);
}

/**
 * Runs `work` with the device's font scale set to 200%, and always restores the original.
 * The recorder opens each screen fresh at that size instead of switching a running app,
 * which is quicker and more repeatable on a slow emulator.
 */
async function atLargeText(
  adb: (args: string[]) => Promise<{ stdout: string }>,
  work: () => Promise<void>,
): Promise<void> {
  const original = (await adb(['shell', 'settings', 'get', 'system', 'font_scale'])).stdout.trim();
  try {
    await adb(['shell', 'settings', 'put', 'system', 'font_scale', LARGE_TEXT_SCALE]);
    await work();
  } finally {
    await (original === '' || original === 'null'
      ? adb(['shell', 'settings', 'delete', 'system', 'font_scale'])
      : adb(['shell', 'settings', 'put', 'system', 'font_scale', original]));
  }
}

/**
 * Records every labelled screen twice: at the device's own text size, and opened fresh at
 * 200% text for the large-text comparison (pragu scan --check-font-scale does the same live).
 */
export async function recordAll(root: string, options: RecordOptions, log: (line: string) => void): Promise<void> {
  const serialArgs = options.serial === undefined ? [] : ['--serial', options.serial];
  const adb = (args: string[]) =>
    run(adbExecutable(), [...(options.serial === undefined ? [] : ['-s', options.serial]), ...args], {
      timeout: 180_000,
      windowsHide: true,
    });
  const cli = join(root, 'packages', 'cli', 'dist', 'bin.js');
  if (!existsSync(cli)) throw new Error('The CLI is not built. Run "pnpm build" first.');
  const fixtures = (await loadFixtures(root)).filter(
    (truth) => options.only === undefined || truth.fixture === options.only,
  );
  if (fixtures.length === 0) throw new Error(`No fixture named "${options.only ?? ''}" has an expected.json.`);
  const context = { adb, cli, serialArgs, log };

  for (const truth of fixtures) {
    if (options.install) {
      const apk = join(root, 'fixtures', truth.fixture, truth.apk);
      if (!existsSync(apk)) {
        throw new Error(`No APK for ${truth.fixture} at ${apk}. Build it with "pnpm fixture:build ${truth.fixture}".`);
      }
      log(`Installing ${truth.fixture}`);
      await adb(['install', '-r', apk]);
    }
    for (const screen of truth.screens) {
      const files = recordingFiles(root, truth.fixture, screen.id);
      await mkdir(dirname(files.json), { recursive: true });
      await recordScreen(context, truth, screen, async (captureDir) => {
        await copyFile(join(captureDir, 'screen-1.json'), files.json);
        await copyFile(join(captureDir, 'screen-1.png'), files.png);
      });
      log(`Recorded ${truth.fixture} › ${screen.id}`);
    }
    await atLargeText(adb, async () => {
      for (const screen of truth.screens) {
        const files = recordingFiles(root, truth.fixture, screen.id);
        // Only the tree is kept from the 200% capture; its screenshot is never analysed.
        await recordScreen(context, truth, screen, (captureDir) =>
          copyFile(join(captureDir, 'screen-1.json'), files.largeTextJson),
        );
        log(`Recorded ${truth.fixture} › ${screen.id} at 200% text`);
      }
    });
  }
}

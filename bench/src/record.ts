import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { parseAndroidCapture } from '@pragu/core';
import type { AndroidRawNode } from '@pragu/core';
import { loadFixtures, recordingFiles } from './recordings.js';

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
  install: string | undefined;
  serial: string | undefined;
}

/**
 * Opens every labelled screen by deep link on a fresh app start, scans it with the
 * real CLI, and stores the capture as a recording. A capture without the screen's
 * marker is rejected, so a slow start can never be recorded as the wrong screen.
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
  if (options.install !== undefined) {
    log(`Installing ${options.install}`);
    await adb(['install', '-r', options.install]);
  }

  for (const truth of await loadFixtures(root)) {
    for (const screen of truth.screens) {
      let recorded = false;
      for (let attempt = 1; attempt <= ATTEMPTS && !recorded; attempt++) {
        await adb(['shell', 'am', 'force-stop', truth.appId]);
        await adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', screen.url, truth.appId]);
        const out = await mkdtemp(join(tmpdir(), 'pragu-bench-'));
        try {
          await run(
            process.execPath,
            [
              cli,
              'scan',
              '--app',
              truth.appId,
              '--no-launch',
              '--screen-name',
              screen.name,
              '--out',
              out,
              '--fail-on',
              'never',
              ...serialArgs,
            ],
            { timeout: 180_000, windowsHide: true },
          );
          const captureFile = join(out, 'capture', 'screen-1.json');
          const capture = parseAndroidCapture(JSON.parse(await readFile(captureFile, 'utf8')));
          if (!containsResourceId(capture.root, screen.marker)) {
            log(
              `${truth.fixture} › ${screen.id}: marker "${screen.marker}" not on screen yet (attempt ${String(attempt)})`,
            );
            continue;
          }
          const files = recordingFiles(root, truth.fixture, screen.id);
          await mkdir(dirname(files.json), { recursive: true });
          await copyFile(captureFile, files.json);
          await copyFile(join(out, 'capture', 'screen-1.png'), files.png);
          log(`Recorded ${truth.fixture} › ${screen.id}`);
          recorded = true;
        } finally {
          await rm(out, { recursive: true, force: true });
        }
      }
      if (!recorded) {
        throw new Error(
          `Could not record ${truth.fixture} › ${screen.id}: the marker "${screen.marker}" never appeared.`,
        );
      }
    }
  }
}

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyze, normalizeAndroidCapture, parseAndroidCapture } from '@pragu/core';
import type { Issue } from '@pragu/core';
import { PNG } from 'pngjs';
import type { ScreenOutcome } from './evaluate.js';
import { parseGroundTruth } from './truth.js';
import type { GroundTruth, TruthScreen } from './truth.js';

// Recordings are real captures (tree + screenshot) committed to the repo, so CI can
// re-measure every rule on every PR without an emulator. They are refreshed with
// `pnpm bench:record` whenever a fixture changes.

export function recordingFiles(root: string, fixture: string, screenId: string): { json: string; png: string } {
  const base = join(root, 'bench', 'recordings', fixture, screenId);
  return { json: `${base}.json`, png: `${base}.png` };
}

/** Every fixture that has ground truth (fixtures/<name>/expected.json), in name order. */
export async function loadFixtures(root: string): Promise<GroundTruth[]> {
  const fixturesDir = join(root, 'fixtures');
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const truths: GroundTruth[] = [];
  for (const name of entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const file = join(fixturesDir, name, 'expected.json');
    if (!existsSync(file)) continue;
    const truth = parseGroundTruth(JSON.parse(await readFile(file, 'utf8')), `fixtures/${name}/expected.json`);
    if (truth.fixture !== name) {
      throw new Error(`fixtures/${name}/expected.json: "fixture" must match its folder name, "${name}".`);
    }
    truths.push(truth);
  }
  return truths;
}

/** Runs the same pipeline as `pragu scan` on one recorded screen. */
export function analyzeRecording(captureJson: unknown, png: Buffer, screen: TruthScreen): Issue[] {
  const capture = parseAndroidCapture(captureJson);
  const normalized = normalizeAndroidCapture(capture, {
    screenId: screen.id,
    screenName: screen.name,
    screenshotFile: null,
  });
  if (!normalized.screen.nodes.some((node) => node.resourceId === screen.marker)) {
    throw new Error(
      `The recording for "${screen.id}" does not show that screen (marker "${screen.marker}" is missing).`,
    );
  }
  const decoded = PNG.sync.read(png);
  return analyze({
    device: normalized.device,
    screens: [normalized.screen],
    rasters: new Map([[screen.id, { width: decoded.width, height: decoded.height, data: decoded.data }]]),
  });
}

export async function loadOutcomes(root: string, truths: readonly GroundTruth[]): Promise<ScreenOutcome[]> {
  const outcomes: ScreenOutcome[] = [];
  for (const truth of truths) {
    for (const screen of truth.screens) {
      const files = recordingFiles(root, truth.fixture, screen.id);
      if (!existsSync(files.json) || !existsSync(files.png)) {
        throw new Error(
          `No recording for ${truth.fixture} › ${screen.id}. Record it on an emulator with "pnpm bench:record".`,
        );
      }
      const issues = analyzeRecording(
        JSON.parse(await readFile(files.json, 'utf8')),
        await readFile(files.png),
        screen,
      );
      outcomes.push({ fixture: truth.fixture, screen, issues });
    }
  }
  return outcomes;
}

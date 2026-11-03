// The real-app bench (ADR-015): open-source apps, labelled blind, split by app into a dev
// half (rules may be tuned on it) and a held-out test half (scored only at releases).
// Each app lives in bench/real/<app>/: expected.json with labels keyed by node id, and
// recordings/<screen>.json|png made by hand with "bench record-real".

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScreenOutcome } from './evaluate.js';
import { analyzeRecording } from './recordings.js';
import { parseGroundTruth } from './truth.js';
import type { GroundTruth } from './truth.js';

export type Split = 'dev' | 'test';

export interface RealApp {
  truth: GroundTruth;
  split: Split;
  /** Where the app comes from and under which licence its screenshots are redistributed. */
  license: string;
  source: string;
}

function required(record: Record<string, unknown>, key: string, source: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value === '') throw new Error(`${source}: "${key}" must be a non-empty string.`);
  return value;
}

/** Validates bench/real/<app>/expected.json; screens carry no deep link or marker. */
export function parseRealApp(value: unknown, source: string): RealApp {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${source} must be an object.`);
  const app = value as Record<string, unknown>;
  const split = required(app, 'split', source);
  if (split !== 'dev' && split !== 'test') throw new Error(`${source}: "split" must be "dev" or "test".`);
  const screens = Array.isArray(app.screens)
    ? app.screens.map((screen: unknown) => ({ url: '-', marker: '-', ...(screen as Record<string, unknown>) }))
    : app.screens;
  const truth = parseGroundTruth({ fixture: app.app, appId: app.appId, apk: '-', screens }, source);
  for (const screen of truth.screens) {
    screen.url = '';
    screen.marker = '';
  }
  return { truth, split, license: required(app, 'license', source), source: required(app, 'source', source) };
}

export function realRecordingFiles(
  root: string,
  app: string,
  screenId: string,
): { json: string; png: string; largeTextJson: string } {
  const base = join(root, 'bench', 'real', app, 'recordings', screenId);
  return { json: `${base}.json`, png: `${base}.png`, largeTextJson: `${base}-large-text.json` };
}

/** Every labelled real app in one split, in name order. */
export async function loadRealApps(root: string, split: Split): Promise<RealApp[]> {
  const dir = join(root, 'bench', 'real');
  if (!existsSync(dir)) return [];
  const apps: RealApp[] = [];
  for (const entry of (await readdir(dir, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(dir, entry.name, 'expected.json');
    if (!existsSync(file)) continue;
    const app = parseRealApp(JSON.parse(await readFile(file, 'utf8')), `bench/real/${entry.name}/expected.json`);
    if (app.truth.fixture !== entry.name)
      throw new Error(`bench/real/${entry.name}/expected.json: "app" must match its folder name.`);
    if (app.split === split) apps.push(app);
  }
  return apps;
}

export async function loadRealOutcomes(root: string, apps: readonly RealApp[]): Promise<ScreenOutcome[]> {
  const outcomes: ScreenOutcome[] = [];
  for (const { truth } of apps) {
    for (const screen of truth.screens) {
      const files = realRecordingFiles(root, truth.fixture, screen.id);
      if (!existsSync(files.json) || !existsSync(files.png)) {
        throw new Error(
          `No recording for ${truth.fixture} › ${screen.id}. Record it with "node bench/dist/cli.js record-real".`,
        );
      }
      const largeText: unknown = existsSync(files.largeTextJson)
        ? JSON.parse(await readFile(files.largeTextJson, 'utf8'))
        : null;
      const issues = analyzeRecording(
        JSON.parse(await readFile(files.json, 'utf8')),
        await readFile(files.png),
        screen,
        largeText,
      );
      outcomes.push({ fixture: truth.fixture, screen, issues });
    }
  }
  return outcomes;
}

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { toSarif } from '@pragu/core';
import type { Issue, SarifPlace, ScanResult } from '@pragu/core';

// Where app code lives, and what is never app code.
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.kt', '.java', '.xml', '.dart', '.swift']);
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'reports',
  'Pods',
  '.expo',
  '.gradle',
  '.idea',
]);
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 1_000_000;
// Source text is held in memory for the lookup; a repository bigger than this gets no locations.
const MAX_TOTAL_BYTES = 32_000_000; // on disk; a JS string can take about twice that in memory

function firstLineWith(file: string, needle: string): number | null {
  const index = readFileSync(file, 'utf8')
    .split('\n')
    .findIndex((line) => line.includes(needle));
  return index === -1 ? null : index + 1;
}

/**
 * Source files under root, read once. Anything unreadable is skipped, never fatal: a comment
 * without a location is better than no comment. Symlinks are neither files nor directories
 * here (Dirent does not follow them), so nothing outside root is ever read.
 */
function readSources(root: string, maxBytes: number, maxFiles: number): { file: string; text: string }[] | null {
  const sources: { file: string; text: string }[] = [];
  let total = 0;
  // An object, not a variable: the walk below changes it, which the compiler cannot see through a closure.
  const state = { overBudget: false };
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (state.overBudget) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('pragu-report')) walk(path);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
        try {
          if (sources.length >= maxFiles) {
            state.overBudget = true;
            return;
          }
          const size = statSync(path).size;
          if (size > MAX_FILE_BYTES) continue;
          total += size;
          if (total > maxBytes) {
            state.overBudget = true;
            return;
          }
          sources.push({ file: path, text: readFileSync(path, 'utf8') });
        } catch {
          // Unreadable file: skip it.
        }
      }
    }
  };
  walk(root);
  // A partial read could make a second match invisible and so show a wrong "only match": say nothing instead.
  return state.overBudget ? null : sources;
}

/**
 * The exact-match lookup of D-43 tier 1: the one source line that names an element id (a
 * testID string, or an Android XML id), or null when no line, or more than one line in the
 * repository, names it. Never guesses, and never falls back to the config. The tree is read
 * once, on the first lookup, within a memory and file-count budget: past either, no id is located.
 */
export function makeIdLocator(
  root: string,
  maxBytes = MAX_TOTAL_BYTES,
  maxFiles = MAX_FILES,
): (id: string) => SarifPlace | null {
  let sources: { file: string; text: string }[] | null | undefined;
  const found = new Map<string, SarifPlace | null>();
  const toUri = (file: string) => relative(root, file).replaceAll('\\', '/');

  return (id) => {
    const cached = found.get(id);
    if (cached !== undefined) return cached;
    sources ??= readSources(root, maxBytes, maxFiles);
    if (sources === null) return null;
    // As a JSX/Kotlin string, or as an Android XML id.
    const needles = [`"${id}"`, `'${id}'`, `id/${id}"`];
    const hits: SarifPlace[] = [];
    for (const { file, text } of sources) {
      if (!needles.some((needle) => text.includes(needle))) continue;
      text.split('\n').forEach((line, index) => {
        if (needles.some((needle) => line.includes(needle))) hits.push({ uri: toUri(file), line: index + 1 });
      });
    }
    const place = hits.length === 1 ? (hits[0] ?? null) : null;
    found.set(id, place);
    return place;
  };
}

/**
 * Finds where each issue belongs in the project, for SARIF (D-43, tier 1): the one source
 * line that names its testID or resource id, if exactly one does; otherwise the screen's line
 * in the config; otherwise the config's or package.json's first line, so GitHub can show it.
 */
export function makeLocator(root: string, configFile: string | null, result: ScanResult): (issue: Issue) => SarifPlace {
  const byId = makeIdLocator(root);
  const toUri = (file: string) => relative(root, file).replaceAll('\\', '/');
  const fallbackFile = configFile ?? (existsSync(join(root, 'package.json')) ? join(root, 'package.json') : null);

  return (issue) => {
    const exact = issue.resourceId === null ? null : byId(issue.resourceId);
    if (exact !== null) return exact;
    if (fallbackFile === null) return { uri: 'pragu-report/pragu-result.json', line: 1 };
    const screen = result.screens.find((candidate) => candidate.id === issue.screenId)?.name;
    const line =
      screen === undefined
        ? null
        : (firstLineWith(fallbackFile, `'${screen}'`) ?? firstLineWith(fallbackFile, `"${screen}"`));
    return { uri: toUri(fallbackFile), line: line ?? 1 };
  };
}

/** Writes pragu-results.sarif next to the report; the GitHub Action uploads it when present. */
export async function writeSarif(
  result: ScanResult,
  outDir: string,
  root: string,
  configFile: string | null,
): Promise<string> {
  const file = join(outDir, 'pragu-results.sarif');
  await writeFile(file, `${JSON.stringify(toSarif(result, makeLocator(root, configFile, result)), null, 2)}\n`);
  return file;
}

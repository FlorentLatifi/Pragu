import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { toSarif } from '@pragu/core';
import type { Issue, SarifPlace, ScanResult } from '@pragu/core';
import { CONFIG_FILES } from './config.js';

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

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= MAX_FILES) return;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('pragu-report')) walk(join(dir, entry.name));
      } else if (SOURCE_EXTENSIONS.has(extname(entry.name)) && statSync(join(dir, entry.name)).size <= MAX_FILE_BYTES) {
        files.push(join(dir, entry.name));
      }
    }
  };
  walk(root);
  return files;
}

function firstLineWith(file: string, needle: string): number | null {
  const index = readFileSync(file, 'utf8')
    .split('\n')
    .findIndex((line) => line.includes(needle));
  return index === -1 ? null : index + 1;
}

// Committed files that most React Native and Android projects have, in order of preference.
const FALLBACK_FILES = [
  'package.json',
  'app.json',
  'android/app/build.gradle',
  'android/app/build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
];

/**
 * A committed file to anchor issues that name no source line, so code scanning can show them.
 * Never report output, which is not in the repository. When the project has none of these,
 * it returns the config path the scan would have read: GitHub still lists the alert, but
 * without a code snippet, since that file does not exist.
 */
function fallbackFile(root: string, configFile: string | null): { file: string; exists: boolean } {
  if (configFile !== null) return { file: configFile, exists: true };
  const found = FALLBACK_FILES.map((name) => join(root, name)).find((file) => existsSync(file));
  return found === undefined ? { file: join(root, CONFIG_FILES[0]), exists: false } : { file: found, exists: true };
}

/**
 * Finds where each issue belongs in the project, for SARIF (D-43, tier 1): the one source
 * line that names its testID or resource id, if exactly one does; otherwise the screen's line
 * in the config; otherwise the first line of a committed project file, so GitHub can show it.
 */
export function makeLocator(root: string, configFile: string | null, result: ScanResult): (issue: Issue) => SarifPlace {
  const files = sourceFiles(root);
  const found = new Map<string, SarifPlace | null>();
  const toUri = (file: string) => relative(root, file).replaceAll('\\', '/');
  const fallback = fallbackFile(root, configFile);

  const byId = (id: string): SarifPlace | null => {
    const cached = found.get(id);
    if (cached !== undefined) return cached;
    // As a JSX/Kotlin string, or as an Android XML id.
    const needles = [`"${id}"`, `'${id}'`, `id/${id}"`];
    const hits = files.flatMap((file) => {
      const line = needles.map((needle) => firstLineWith(file, needle)).find((value) => value !== null);
      return line === undefined ? [] : [{ uri: toUri(file), line }];
    });
    const place = hits.length === 1 ? (hits[0] ?? null) : null;
    found.set(id, place);
    return place;
  };

  return (issue) => {
    const exact = issue.resourceId === null ? null : byId(issue.resourceId);
    if (exact !== null) return exact;
    const uri = toUri(fallback.file);
    if (!fallback.exists) return { uri, line: 1 };
    const screen = result.screens.find((candidate) => candidate.id === issue.screenId)?.name;
    const line =
      screen === undefined
        ? null
        : (firstLineWith(fallback.file, `'${screen}'`) ?? firstLineWith(fallback.file, `"${screen}"`));
    return { uri, line: line ?? 1 };
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

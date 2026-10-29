import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseConfig } from '@pragu/core';
import type { PraguConfig } from '@pragu/core';
import { EXIT, PraguError } from './errors.js';

export const CONFIG_FILES = ['pragu.config.ts', 'pragu.config.mts', 'pragu.config.js', 'pragu.config.mjs'] as const;

export interface LoadedConfig {
  config: PraguConfig;
  /** The file it came from, or null when the project has none. */
  file: string | null;
}

/**
 * Imports the config without Node's "reparsing as ES module" warning, which appears for
 * a .ts file in a project whose package.json has no "type" (most React Native apps).
 * It concerns Pragu's own import, so only that warning is muted, and only meanwhile.
 */
async function importQuietly(file: string): Promise<unknown> {
  const emitWarning = process.emitWarning.bind(process);
  process.emitWarning = (warning: string | Error, ...rest: unknown[]) => {
    const code = typeof rest[0] === 'object' && rest[0] !== null ? (rest[0] as { code?: string }).code : rest[1];
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
    (emitWarning as (...args: unknown[]) => void)(warning, ...rest);
  };
  try {
    return ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
  } finally {
    process.emitWarning = emitWarning;
  }
}

/**
 * Finds and validates the project's config. A .ts file is loaded with Node's own type
 * stripping (Node 22.18+), so no loader is needed; it may use types, not TS-only syntax
 * such as enums.
 */
export async function loadConfig(cwd: string, explicit: string | undefined): Promise<LoadedConfig> {
  const file =
    explicit === undefined
      ? CONFIG_FILES.map((name) => join(cwd, name)).find((path) => existsSync(path))
      : resolve(cwd, explicit);
  if (file === undefined) return { config: {}, file: null };
  const shown = relative(cwd, file) || file;
  if (!existsSync(file)) {
    throw new PraguError(EXIT.usage, `The config file was not found: ${shown}`, 'Check the path given to --config.');
  }
  let loaded: unknown;
  try {
    loaded = await importQuietly(file);
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      `Could not load ${shown}: ${error instanceof Error ? error.message : String(error)}`,
      'Pragu reads pragu.config.ts with Node 22.18 or newer. Use plain TypeScript types (no enums), or rename it to pragu.config.mjs.',
    );
  }
  try {
    return { config: parseConfig(loaded, shown), file };
  } catch (error) {
    throw new PraguError(
      EXIT.usage,
      error instanceof Error ? error.message : String(error),
      `Fix the setting in ${shown}.`,
    );
  }
}

const STARTER = `import { defineConfig } from 'pragu';

// Pragu's settings for this project. Flags given to "pragu scan" win over these.
export default defineConfig({
  app: 'com.example.shop',
  failOn: 'error',
  // Turn a rule off, or change its severity:
  // rules: { 'target/size': 'error' },
  // Issues you decided to live with; every entry needs a reason, and reports count them:
  // ignore: [{ rule: 'contrast/text', resourceId: 'promo-banner', reason: 'Brand colours; fix tracked in #123' }],
});
`;

/** Writes a starter pragu.config.ts; never overwrites an existing config. */
export async function initConfig(cwd: string): Promise<string> {
  const existing = CONFIG_FILES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (existing !== undefined) {
    throw new PraguError(
      EXIT.usage,
      `This project already has ${relative(cwd, existing)}.`,
      'Edit it, or delete it first if you want a fresh one.',
    );
  }
  const file = join(cwd, 'pragu.config.ts');
  await writeFile(file, STARTER);
  return file;
}

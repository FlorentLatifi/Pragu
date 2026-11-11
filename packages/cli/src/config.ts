import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
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

// "Cannot find package 'pragu'" is the usual failure (a config that imports from 'pragu' with
// no local install, e.g. run through npx), so it gets its own hint instead of the TypeScript one.
function configLoadHint(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Cannot find (package|module) 'pragu'/.test(message)) {
    return "The config imports from 'pragu', which is not installed here. Install it (npm install --save-dev pragu), or use \"import type { PraguConfig } from 'pragu'\", which needs no install.";
  }
  return 'Pragu reads pragu.config.ts with Node 22.18 or newer. Use plain TypeScript types (no enums), or rename it to pragu.config.mjs.';
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
      configLoadHint(error),
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

// The import is type-only on purpose: Node's type stripping erases it, so the file loads with
// "npx pragu" and no local install. A value import of 'pragu' would fail to resolve there.
const STARTER = `import type { PraguConfig } from 'pragu';

// Pragu's settings for this project. Flags given to "pragu scan" win over these.
export default {
  app: 'com.example.shop',
  failOn: 'error',
  // Screens to check, each opened on a fresh start; waitFor is a testID shown once the screen has loaded:
  // screens: [{ name: 'Cart', deepLink: 'shop://cart', waitFor: 'cart-title' }],
  // Turn a rule off, or change its severity:
  // rules: { 'target/size': 'error' },
  // Issues you decided to live with; every entry needs a reason, and reports count them:
  // ignore: [{ rule: 'contrast/text', resourceId: 'promo-banner', reason: 'Brand colours; fix tracked in #123' }],
} satisfies PraguConfig;
`;

const WORKFLOW = `name: Accessibility

# Written by "pragu init --github". Scans the app on an emulator on every pull request and
# on pushes to the default branch, so each pull request is compared with the latest scan of it.
on:
  pull_request:
  push:
    branches: [main] # your default branch

permissions:
  contents: read
  pull-requests: write # the comment
  actions: read # the default branch's latest report
  security-events: write # SARIF in code scanning

jobs:
  pragu:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24

      # Build your app's APK here, for example with Expo:
      #   - run: npm ci && npx expo prebuild --platform android && (cd android && ./gradlew assembleRelease)

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
      - name: Scan on an emulator
        uses: ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d # v2.38.0
        with:
          api-level: 36
          target: google_apis
          arch: x86_64
          emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          # Public repositories get --redact: anyone signed in to GitHub can download their artifacts.
          script: npx --yes pragu scan --install android/app/build/outputs/apk/release/app-release.apk --out pragu-report \${{ github.event.repository.private && ' ' || '--redact' }}

      - uses: FlorentLatifi/Pragu@v0
        if: always()
`;

/** Writes a starter GitHub Actions workflow (ADR-014); never overwrites one. */
export async function initWorkflow(cwd: string): Promise<string> {
  const file = join(cwd, '.github', 'workflows', 'pragu.yml');
  if (existsSync(file)) {
    throw new PraguError(
      EXIT.usage,
      `This project already has ${relative(cwd, file)}.`,
      'Edit it, or delete it first if you want a fresh one.',
    );
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, WORKFLOW);
  return file;
}

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

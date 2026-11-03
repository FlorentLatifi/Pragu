import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Adb } from './adb.js';
import { AGENT_PACKAGE } from './agent.js';
import { EXIT, PraguError } from './errors.js';

/** Where a published CLI keeps the agent it ships; scripts/bundle-agent.mjs puts it there (ADR-013). */
export const BUNDLED_AGENT_APK = fileURLToPath(new URL('../agent/pragu-agent.apk', import.meta.url));
// In the monorepo the CLI finds the agent APK that `pnpm agent:build` produced.
const DEV_AGENT_APK = fileURLToPath(
  new URL('../../../agents/android/agent/build/outputs/apk/release/agent-release.apk', import.meta.url),
);

/** The agent APK a scan installs: --agent-apk, then PRAGU_AGENT_APK, then the bundled one, then this repo's build. */
export function agentApkPath(explicit: string | undefined): string {
  return explicit ?? process.env.PRAGU_AGENT_APK ?? (existsSync(BUNDLED_AGENT_APK) ? BUNDLED_AGENT_APK : DEV_AGENT_APK);
}

export function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * The bundled agent must match the checksum written beside it at release time. The agent
 * can read every screen, so a changed file is refused rather than installed.
 */
export function verifyBundledAgent(apk: string): void {
  const sumFile = apk.replace(/\.apk$/, '.sha256');
  const reinstall = 'Reinstall Pragu from npm (npm install -g pragu), or run "npx pragu" again.';
  if (!existsSync(sumFile)) {
    throw new PraguError(EXIT.environment, `The agent APK has no checksum beside it (${sumFile}).`, reinstall);
  }
  const expected = readFileSync(sumFile, 'utf8').trim().split(/\s+/)[0];
  if (sha256(apk) !== expected) {
    throw new PraguError(
      EXIT.environment,
      'The bundled agent APK does not match its checksum, so Pragu will not install it.',
      reinstall,
    );
  }
}

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

/** The installed agent's SHA-256, or null when it is not installed. */
async function installedChecksum(device: Pick<Adb, 'shell'>): Promise<string | null> {
  try {
    const path = (await device.shell(['pm', 'path', AGENT_PACKAGE]))
      .trim()
      .split('\n')[0]
      ?.replace(/^package:/, '');
    if (path === undefined || path === '') return null;
    return (await device.shell(['sha256sum', path])).trim().split(/\s+/)[0] ?? null;
  } catch {
    return null;
  }
}

/** Installs the agent unless the device already has these exact bytes, which saves a second or more per scan. */
export async function ensureAgent(device: Pick<Adb, 'run' | 'shell'>, agentApk: string): Promise<void> {
  if (agentApk === BUNDLED_AGENT_APK) verifyBundledAgent(agentApk);
  if ((await installedChecksum(device)) === sha256(agentApk)) return;
  await installAgent(device, agentApk);
}

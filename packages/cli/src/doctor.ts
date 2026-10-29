import { parseDevices } from './adb.js';

/** The agent's minSdk: Android 8.0. */
const MIN_API_LEVEL = 26;
const MIN_NODE: readonly [number, number] = [22, 18];

export interface Check {
  ok: boolean;
  summary: string;
  /** What to do, when the check failed. */
  fix?: string;
}

/** What doctor needs from the machine; tests pass fakes. */
export interface DoctorDeps {
  nodeVersion: string;
  /** Runs adb with these arguments and returns stdout; throws when adb cannot run. */
  adb: (args: string[]) => Promise<string>;
  adbPath: string;
  agentApk: string;
  agentApkExists: boolean;
  /** Loads the project's config; throws a readable error when it is invalid. */
  checkConfig: () => Promise<string | null>;
}

function nodeCheck(version: string): Check {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok
    ? { ok, summary: `Node ${version}` }
    : {
        ok,
        summary: `Node ${version} is too old.`,
        fix: `Install Node ${String(MIN_NODE[0])}.${String(MIN_NODE[1])} or newer (it reads pragu.config.ts without a loader).`,
      };
}

async function adbCheck(deps: DoctorDeps): Promise<Check> {
  try {
    const firstLine = (await deps.adb(['version'])).split(/\r?\n/)[0]?.trim() ?? 'adb';
    return { ok: true, summary: `${firstLine} (${deps.adbPath})` };
  } catch {
    return {
      ok: false,
      summary: 'adb could not run.',
      fix: 'Install the Android SDK platform-tools and set ANDROID_HOME to the SDK folder.',
    };
  }
}

async function deviceChecks(deps: DoctorDeps): Promise<Check[]> {
  const devices = parseDevices(await deps.adb(['devices']));
  const ready = devices.filter((device) => device.state === 'device');
  if (ready.length === 0) {
    const unauthorized = devices.some((device) => device.state === 'unauthorized');
    const offline = devices.some((device) => device.state === 'offline');
    return [
      {
        ok: false,
        summary: unauthorized
          ? 'A device is connected but has not authorised this computer for USB debugging.'
          : offline
            ? 'A device is connected but offline.'
            : 'No Android device or emulator is connected.',
        fix: unauthorized
          ? 'Unlock the phone and accept the "Allow USB debugging?" prompt.'
          : offline
            ? 'Wait for the emulator to finish booting, or reconnect the phone; then run "adb devices".'
            : 'Start an emulator (emulator -avd <name>) or connect a phone with USB debugging on.',
      },
    ];
  }
  const checks: Check[] = [];
  for (const device of ready) {
    const api = Number((await deps.adb(['-s', device.serial, 'shell', 'getprop', 'ro.build.version.sdk'])).trim());
    checks.push(
      api >= MIN_API_LEVEL
        ? { ok: true, summary: `${device.serial}: Android API ${String(api)}` }
        : {
            ok: false,
            summary: `${device.serial}: Android API ${String(api)} is too old.`,
            fix: `Pragu's agent needs Android 8.0 (API ${String(MIN_API_LEVEL)}) or newer. Use a newer emulator image or phone.`,
          },
    );
  }
  if (ready.length > 1) {
    checks.push({ ok: true, summary: `${String(ready.length)} devices connected; choose one with --serial <id>.` });
  }
  return checks;
}

async function configCheck(deps: DoctorDeps): Promise<Check> {
  try {
    const file = await deps.checkConfig();
    return { ok: true, summary: file === null ? 'No pragu.config.ts; defaults apply.' : `${file} is valid.` };
  } catch (error) {
    return {
      ok: false,
      summary: error instanceof Error ? error.message : String(error),
      fix: 'Fix the setting it names; "pragu init" shows a starter config.',
    };
  }
}

/** Checks everything a scan needs, in the order a person would fix it. */
export async function runDoctor(deps: DoctorDeps): Promise<Check[]> {
  const checks = [nodeCheck(deps.nodeVersion)];
  const adb = await adbCheck(deps);
  checks.push(adb);
  if (adb.ok) checks.push(...(await deviceChecks(deps)));
  checks.push(
    deps.agentApkExists
      ? { ok: true, summary: `Agent APK found (${deps.agentApk}).` }
      : {
          ok: false,
          summary: `The Pragu agent APK was not found at ${deps.agentApk}.`,
          fix: 'Build it with "pnpm agent:build", or pass --agent-apk <path> to pragu scan.',
        },
  );
  checks.push(await configCheck(deps));
  return checks;
}

export function formatChecks(checks: readonly Check[]): string {
  const lines = checks.map((check) => {
    const line = `  ${check.ok ? 'OK     ' : 'PROBLEM'}  ${check.summary}`;
    return check.fix === undefined ? line : `${line}\n           Fix: ${check.fix}`;
  });
  const problems = checks.filter((check) => !check.ok).length;
  const verdict =
    problems === 0
      ? 'Ready to scan.'
      : `${String(problems)} ${problems === 1 ? 'problem' : 'problems'} to fix before scanning.`;
  return `Pragu doctor\n${lines.join('\n')}\n${verdict}\n`;
}

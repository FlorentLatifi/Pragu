import { execFile, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { EXIT, PraguError } from './errors.js';

const execFileAsync = promisify(execFile);

/** adb from ANDROID_HOME (or the older ANDROID_SDK_ROOT), else whatever is on PATH. */
export function findAdb(env: NodeJS.ProcessEnv = process.env): string {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  for (const sdk of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    if (sdk !== undefined && sdk !== '') {
      const candidate = join(sdk, 'platform-tools', executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'adb';
}

export interface DeviceEntry {
  serial: string;
  state: string;
}

export function parseDevices(output: string): DeviceEntry[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('*'))
    .map((line) => {
      const [serial = '', state = ''] = line.split(/\s+/);
      return { serial, state };
    });
}

export class Adb {
  constructor(
    readonly executable: string,
    readonly serial: string | null = null,
  ) {}

  withSerial(serial: string): Adb {
    return new Adb(this.executable, serial);
  }

  private args(args: string[]): string[] {
    return this.serial === null ? args : ['-s', this.serial, ...args];
  }

  async run(args: string[], timeoutMs = 60_000): Promise<string> {
    try {
      const { stdout } = await execFileAsync(this.executable, this.args(args), {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
      return stdout;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new PraguError(
          EXIT.environment,
          'adb was not found.',
          'Install the Android SDK platform-tools and set ANDROID_HOME to the SDK folder.',
        );
      }
      const stderr = (error as { stderr?: string }).stderr ?? '';
      throw new PraguError(EXIT.environment, `adb ${args.join(' ')} failed: ${stderr.trim() || String(error)}`);
    }
  }

  shell(args: string[], timeoutMs?: number): Promise<string> {
    return this.run(['shell', ...args], timeoutMs);
  }

  spawnShell(args: string[]): ChildProcessWithoutNullStreams {
    return spawn(this.executable, this.args(['shell', ...args]), { windowsHide: true });
  }
}

/** The one connected device to scan, or a clear error about why there is none. */
export async function selectDevice(adb: Adb, requested: string | undefined): Promise<string> {
  const devices = parseDevices(await adb.run(['devices']));
  const ready = devices.filter((device) => device.state === 'device').map((device) => device.serial);
  if (requested !== undefined) {
    if (ready.includes(requested)) return requested;
    throw new PraguError(
      EXIT.environment,
      `Device "${requested}" is not connected and ready.`,
      `Check "adb devices". Connected: ${ready.join(', ') || 'none'}.`,
    );
  }
  if (ready.length === 1 && ready[0] !== undefined) return ready[0];
  if (ready.length === 0) {
    const unauthorized = devices.some((device) => device.state === 'unauthorized');
    throw new PraguError(
      EXIT.environment,
      unauthorized
        ? 'A device is connected but has not authorised this computer for USB debugging.'
        : 'No Android device or emulator is connected.',
      unauthorized
        ? 'Unlock the phone and accept the "Allow USB debugging?" prompt.'
        : 'Start an emulator (emulator -avd <name>) or connect a phone with USB debugging on.',
    );
  }
  throw new PraguError(
    EXIT.usage,
    `Several devices are connected: ${ready.join(', ')}.`,
    'Choose one with --serial <id>.',
  );
}

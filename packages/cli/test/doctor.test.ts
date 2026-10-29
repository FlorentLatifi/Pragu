import { describe, expect, it } from 'vitest';
import { formatChecks, runDoctor } from '../src/doctor.js';
import type { DoctorDeps } from '../src/doctor.js';

function deps(overrides: Partial<DoctorDeps> & { devices?: string; api?: string } = {}): DoctorDeps {
  const { devices = 'List of devices attached\nemulator-5554\tdevice\n', api = '36', ...rest } = overrides;
  return {
    nodeVersion: '24.4.0',
    adb: (args) => {
      if (args[0] === 'version') return Promise.resolve('Android Debug Bridge version 1.0.41\nVersion 36.0.0');
      if (args[0] === 'devices') return Promise.resolve(devices);
      return Promise.resolve(`${api}\n`);
    },
    adbPath: '/sdk/platform-tools/adb',
    agentApk: '/pragu/agent-release.apk',
    agentApkExists: true,
    checkConfig: () => Promise.resolve('pragu.config.ts'),
    ...rest,
  };
}

describe('pragu doctor', () => {
  it('reports a machine that is ready to scan', async () => {
    const checks = await runDoctor(deps());
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(formatChecks(checks)).toBe(
      [
        'Pragu doctor',
        '  OK       Node 24.4.0',
        '  OK       Android Debug Bridge version 1.0.41 (/sdk/platform-tools/adb)',
        '  OK       emulator-5554: Android API 36',
        '  OK       Agent APK found (/pragu/agent-release.apk).',
        '  OK       pragu.config.ts is valid.',
        'Ready to scan.',
        '',
      ].join('\n'),
    );
  });

  it.each([
    ['an old Node', { nodeVersion: '22.13.1' }, 'Install Node 22.18 or newer'],
    ['no device', { devices: 'List of devices attached\n' }, 'Start an emulator'],
    [
      'an unauthorised phone',
      { devices: 'List of devices attached\nR58M\tunauthorized\n' },
      'accept the "Allow USB debugging?" prompt',
    ],
    [
      'an offline emulator',
      { devices: 'List of devices attached\nemulator-5554\toffline\n' },
      'Wait for the emulator to finish booting',
    ],
    ['an old Android', { api: '25' }, 'needs Android 8.0 (API 26) or newer'],
    ['a missing agent', { agentApkExists: false }, 'pnpm agent:build'],
    [
      'a broken config',
      { checkConfig: () => Promise.reject(new Error('pragu.config.ts: unknown setting "colour".')) },
      'pragu init',
    ],
  ] as const)('gives the fix for %s', async (_name, overrides, fix) => {
    const checks = await runDoctor(deps(overrides));
    const problem = checks.find((check) => !check.ok);
    expect(problem?.fix).toContain(fix);
    expect(formatChecks(checks)).toMatch(/1 problem to fix before scanning\.\n$/);
  });

  it('skips the device checks when adb cannot run, and says how to install it', async () => {
    const checks = await runDoctor(deps({ adb: () => Promise.reject(new Error('ENOENT')) }));
    expect(checks.map((check) => check.summary)).toContain('adb could not run.');
    expect(checks.some((check) => check.summary.includes('Android API'))).toBe(false);
  });

  it('notes several devices, so the scan needs --serial', async () => {
    const checks = await runDoctor(
      deps({ devices: 'List of devices attached\nemulator-5554\tdevice\nR58M\tdevice\n' }),
    );
    expect(checks.at(-3)?.summary).toBe('2 devices connected; choose one with --serial <id>.');
  });
});

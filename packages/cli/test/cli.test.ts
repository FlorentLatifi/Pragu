import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Issue, ScanResult } from '@pragu/core';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { captureOf, createRaster, fillRect, paintText, rawNode, rect } from '../../core/test/helpers.js';
import { parseDevices } from '../src/adb.js';
import { formatError, PraguError } from '../src/errors.js';
import { main } from '../src/main.js';
import { FrameDecoder, parseHeader } from '../src/protocol.js';
import { exitCodeFor } from '../src/scan.js';

function capturingIo() {
  const io = { stdout: '', stderr: '' };
  return {
    io,
    sink: {
      out: (text: string) => {
        io.stdout += text;
      },
      err: (text: string) => {
        io.stderr += text;
      },
    },
  };
}

describe('pragu command line', () => {
  it('prints help with no arguments', async () => {
    const { io, sink } = capturingIo();
    expect(await main([], sink)).toBe(0);
    expect(io.stdout).toContain('pragu scan --app <applicationId>');
    expect(io.stdout).toContain('never certifies compliance');
  });

  it('prints its version', async () => {
    const { io, sink } = capturingIo();
    expect(await main(['--version'], sink)).toBe(0);
    expect(io.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('rejects unknown commands with exit code 2 and a next step', async () => {
    const { io, sink } = capturingIo();
    expect(await main(['scna'], sink)).toBe(2);
    expect(io.stderr).toBe('pragu: Unknown command "scna".\n  Fix: Run "pragu --help" to see the commands.\n');
  });

  it('is honest about commands planned for later milestones', async () => {
    const { io, sink } = capturingIo();
    expect(await main(['doctor'], sink)).toBe(2);
    expect(io.stderr).toContain('"pragu doctor" is planned for M1');
  });

  it('validates scan arguments before touching a device', async () => {
    const missingApp = capturingIo();
    expect(await main(['scan'], missingApp.sink)).toBe(2);
    expect(missingApp.io.stderr).toContain('Add --app <applicationId>');

    const badFlag = capturingIo();
    expect(await main(['scan', '--colour'], badFlag.sink)).toBe(2);
    expect(badFlag.io.stderr).toContain("Unknown option '--colour'");

    const badLevel = capturingIo();
    expect(await main(['scan', '--app', 'x', '--fail-on', 'critical'], badLevel.sink)).toBe(2);
    expect(badLevel.io.stderr).toContain('--fail-on must be one of error, warning, info, never.');
  });

  it('prints scan help', async () => {
    const { io, sink } = capturingIo();
    expect(await main(['scan', '--help'], sink)).toBe(0);
    expect(io.stdout).toContain('--from-capture');
  });
});

describe('scan --from-capture (whole pipeline, no device)', () => {
  let dir = '';
  afterEach(async () => {
    if (dir !== '') await rm(dir, { recursive: true, force: true });
  });

  async function writeFixtureCapture(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), 'pragu-cli-'));
    const root = rawNode({
      bounds: [0, 0, 400, 400],
      children: [
        rawNode({
          resourceId: 'promo-apply',
          clickable: true,
          bounds: [100, 20, 200, 68],
          children: [rawNode({ text: 'Apply code', bounds: [110, 30, 190, 58] })],
        }),
        rawNode({
          resourceId: 'seed-tiny-dismiss',
          clickable: true,
          contentDescription: 'Dismiss promotion',
          bounds: [202, 36, 218, 52],
        }),
        rawNode({
          resourceId: 'seed-unlabeled-remove',
          className: 'android.widget.Button',
          clickable: true,
          bounds: [300, 100, 348, 148],
        }),
        rawNode({
          resourceId: 'seed-low-contrast',
          className: 'android.widget.TextView',
          text: 'Free shipping',
          textSizePx: 14,
          bounds: [10, 250, 390, 290],
        }),
      ],
    });
    const capture = { ...captureOf(root), screenWidthPx: 400, screenHeightPx: 400 };
    const raster = createRaster(400, 400, 0xffffff);
    fillRect(raster, rect(100, 20, 200, 68), 0x1f5e4b);
    paintText(raster, rect(110, 30, 190, 58), 0xffffff, 0x8faea5);
    paintText(raster, rect(10, 250, 390, 290), 0xa3a3a3, 0xd6d6d6);
    const png = new PNG({ width: 400, height: 400 });
    png.data = Buffer.from(raster.data);
    const file = join(dir, 'screen-1.json');
    await writeFile(file, JSON.stringify(capture));
    await writeFile(join(dir, 'screen-1.png'), PNG.sync.write(png));
    return file;
  }

  it('writes the JSON result and HTML report, and exits 1 because errors were found', async () => {
    const captureFile = await writeFixtureCapture();
    const out = join(dir, 'out');
    const { io, sink } = capturingIo();

    const code = await main(['scan', '--from-capture', captureFile, '--out', out, '--screen-name', 'Cart'], sink);

    expect(code).toBe(1);
    const result = JSON.parse(await readFile(join(out, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.issues.map((issue) => [issue.ruleId, issue.resourceId])).toEqual([
      ['target/size', 'seed-tiny-dismiss'],
      ['name/interactive-missing', 'seed-unlabeled-remove'],
      ['contrast/text', 'seed-low-contrast'],
    ]);
    const report = await readFile(join(out, 'pragu-report.html'), 'utf8');
    expect(report).toContain('<h1>3 barriers found in com.example.shop</h1>');
    expect(report.match(/class="marker"/g)).toHaveLength(3);
    expect(io.stdout).toContain('3 barriers: 2 errors, 1 warning, 0 info');
    expect(io.stdout).toContain('1. Warning: Touch target is too small · seed-tiny-dismiss (WCAG 2.5.8)');
  });

  it('fails on target warnings only when asked with --fail-on warning', async () => {
    const captureFile = await writeFixtureCapture();
    const { sink } = capturingIo();
    // Targets are warnings (ADR-007), so they fail a build only at --fail-on warning or stricter.
    expect(
      await main(['scan', '--from-capture', captureFile, '--out', join(dir, 'w'), '--fail-on', 'warning'], sink),
    ).toBe(1);
  });

  it('exits 0 with --fail-on never', async () => {
    const captureFile = await writeFixtureCapture();
    const { sink } = capturingIo();
    expect(
      await main(['scan', '--from-capture', captureFile, '--out', join(dir, 'o'), '--fail-on', 'never'], sink),
    ).toBe(0);
    expect(existsSync(join(dir, 'o', 'pragu-report.html'))).toBe(true);
  });

  it('explains a missing capture file', async () => {
    const { io, sink } = capturingIo();
    expect(await main(['scan', '--from-capture', 'nope.json'], sink)).toBe(2);
    expect(io.stderr).toContain('--from-capture needs nope.json and nope.png.');
  });
});

describe('exitCodeFor', () => {
  const issue = (severity: Issue['severity']) => ({ severity }) as Issue;
  it('fails only at or above the threshold', () => {
    expect(exitCodeFor([issue('warning')], 'error')).toBe(0);
    expect(exitCodeFor([issue('warning')], 'warning')).toBe(1);
    expect(exitCodeFor([issue('error')], 'info')).toBe(1);
    expect(exitCodeFor([issue('error')], 'never')).toBe(0);
    expect(exitCodeFor([], 'info')).toBe(0);
  });
});

describe('parseDevices', () => {
  it('reads adb devices output, including unauthorised phones', () => {
    const output = 'List of devices attached\nemulator-5554\tdevice\n0A1B2C\tunauthorized\n\n* daemon started *\n';
    expect(parseDevices(output)).toEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: '0A1B2C', state: 'unauthorized' },
    ]);
  });
});

describe('FrameDecoder', () => {
  it('decodes a header-only frame', () => {
    expect(new FrameDecoder().push(Buffer.from('{"ok":true,"data":{"agentVersion":"0.0.1"}}\n'))).toEqual([
      { header: { ok: true, data: { agentVersion: '0.0.1' } }, payloads: new Map() },
    ]);
  });

  it('reassembles payloads split across chunks, and several frames in one chunk', () => {
    const decoder = new FrameDecoder();
    const header =
      '{"ok":true,"payloads":[{"name":"tree","bytes":4,"type":"application/json"},{"name":"screenshot","bytes":3,"type":"image/png"}]}\n';
    expect(decoder.push(Buffer.from(header + '{}'))).toEqual([]);
    const frames = decoder.push(
      Buffer.concat([Buffer.from('[]'), Buffer.from([1, 2, 3]), Buffer.from('{"ok":false,"error":"no window"}\n')]),
    );
    expect(frames).toHaveLength(2);
    expect(frames[0]?.payloads.get('tree')?.toString()).toBe('{}[]');
    expect([...(frames[0]?.payloads.get('screenshot') ?? [])]).toEqual([1, 2, 3]);
    expect(frames[1]?.header).toEqual({ ok: false, error: 'no window' });
  });

  it('rejects malformed headers with a readable message', () => {
    expect(() => parseHeader('not json')).toThrow('The agent sent a header that is not JSON: not json');
    expect(() => parseHeader('{"data":1}')).toThrow('without an "ok" flag');
    expect(() => parseHeader('{"ok":true,"payloads":[{"name":"x","bytes":-1}]}')).toThrow('invalid payload');
  });
});

describe('formatError', () => {
  it('formats actionable errors and flags unexpected ones as bugs', () => {
    expect(formatError(new PraguError(3, 'No device.', 'Start one.'))).toEqual({
      text: 'pragu: No device.\n  Fix: Start one.\n',
      exitCode: 3,
    });
    const unexpected = formatError(new Error('boom'));
    expect(unexpected.exitCode).toBe(3);
    expect(unexpected.text).toContain('unexpected error');
    expect(formatError('plain').text).toContain('plain');
  });
});

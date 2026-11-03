import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Issue, ScanResult } from '@pragu/core';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { captureOf, createRaster, fillRect, paintText, rawNode, rect } from '../../core/test/helpers.js';
import { Adb, parseDevices } from '../src/adb.js';
import { initConfig, loadConfig } from '../src/config.js';
import { formatError, PraguError } from '../src/errors.js';
import { main } from '../src/main.js';
import { installAgent } from '../src/scan.js';
import { syncedFolder, syncedFolderWarning } from '../src/cloud.js';
import { downscale, reportScreenshot } from '../src/screenshot.js';
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

  it('lists the rules, explains one with its fixes, and names the known ones for a typo', async () => {
    const list = capturingIo();
    expect(await main(['rules'], list.sink)).toBe(0);
    expect(list.io.stdout).toMatch(/^9 rules\./);
    expect(list.io.stdout).toMatch(/ {2}contrast\/text +error +Text contrast is too low +WCAG 1\.4\.3/);

    const one = capturingIo();
    expect(await main(['rules', '--explain', 'target/size'], one.sink)).toBe(0);
    expect(one.io.stdout).toContain('Severity: warning (confidence medium)');
    expect(one.io.stdout).toContain('Fix in Jetpack Compose:');

    const typo = capturingIo();
    expect(await main(['rules', '--explain', 'contrast'], typo.sink)).toBe(2);
    expect(typo.io.stderr).toContain('There is no rule "contrast".');
    expect(typo.io.stderr).toContain('contrast/text');
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
    expect(result.schemaVersion).toBe('0.11.0');
    expect(result.issues.map((issue) => [issue.ruleId, issue.resourceId])).toEqual([
      ['target/size', 'seed-tiny-dismiss'],
      ['name/interactive-missing', 'seed-unlabeled-remove'],
      ['contrast/text', 'seed-low-contrast'],
    ]);
    const report = await readFile(join(out, 'pragu-report.html'), 'utf8');
    expect(report).toContain('<h1>3 barriers found in com.example.shop</h1>');
    expect(report.match(/class="marker-box"/g)).toHaveLength(3);
    expect(report.match(/<a class="screen-sign"/g)).toHaveLength(3);
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

  it('turns rules off and ignores issues as the config says, and counts what it ignored', async () => {
    const captureFile = await writeFixtureCapture();
    const configFile = join(dir, 'pragu.config.mjs');
    await writeFile(
      configFile,
      "export default { rules: { 'target/size': 'off' }, ignore: [{ rule: 'contrast/text', reason: 'Brand colours' }] };\n",
    );
    const { sink } = capturingIo();
    const out = join(dir, 'configured');

    await main(
      ['scan', '--from-capture', captureFile, '--config', configFile, '--out', out, '--fail-on', 'never'],
      sink,
    );

    const result = JSON.parse(await readFile(join(out, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.summary.rulesRun).not.toContain('target/size');
    expect(result.issues.map((found) => found.ruleId)).toEqual(['name/interactive-missing']);
    expect(result.summary.ignored).toBe(1);
  });

  it('adopts gradually: accept a scan as the baseline, then fail only on new issues', async () => {
    const captureFile = await writeFixtureCapture();
    const { io, sink } = capturingIo();
    const first = join(dir, 'first');
    expect(await main(['scan', '--from-capture', captureFile, '--out', first], sink)).toBe(1);

    const baselineFile = join(dir, 'pragu-baseline.json');
    const fromResult = ['--from', join(first, 'pragu-result.json'), '--out', baselineFile];
    expect(await main(['baseline', 'create', ...fromResult], sink)).toBe(0);
    expect(io.stdout).toContain('accepted issues');
    expect(await main(['baseline', 'create', ...fromResult], sink)).toBe(2);
    expect(io.stderr).toContain('Use "pragu baseline update" to replace it on purpose.');
    expect(await main(['baseline', 'update', ...fromResult], sink)).toBe(0);

    const second = join(dir, 'second');
    expect(await main(['scan', '--from-capture', captureFile, '--baseline', baselineFile, '--out', second], sink)).toBe(
      0,
    );
    const result = JSON.parse(await readFile(join(second, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.issues.every((found) => found.inBaseline)).toBe(true);
    expect(result.summary.baseline).toMatchObject({ newIssues: 0, fixed: 0 });
    expect(io.stdout).toContain('Baseline: 0 new');
  });

  it('explains a missing baseline and a missing scan result', async () => {
    const captureFile = await writeFixtureCapture();
    const { io, sink } = capturingIo();
    expect(
      await main(
        ['scan', '--from-capture', captureFile, '--baseline', join(dir, 'nope.json'), '--out', join(dir, 'x')],
        sink,
      ),
    ).toBe(2);
    expect(io.stderr).toContain('pragu baseline create --from');
    expect(await main(['baseline', 'create', '--from', join(dir, 'none.json')], sink)).toBe(2);
    expect(await main(['baseline', 'delete'], sink)).toBe(2);
  });

  it('compares with the 200% capture saved next to the first, and keeps it in the result', async () => {
    const captureFile = await writeFixtureCapture();
    const capture = JSON.parse(await readFile(captureFile, 'utf8')) as ReturnType<typeof captureOf>;
    const free = capture.windows[0]?.root?.children[3];
    if (free === undefined) throw new Error('fixture has the shipping text');
    free.textCollapsedChars = 0;
    const large = structuredClone(capture);
    const freeLarge = large.windows[0]?.root?.children[3];
    if (freeLarge === undefined) throw new Error('fixture has the shipping text');
    freeLarge.textCollapsedChars = 3;
    large.device.fontScale = 2;
    await writeFile(captureFile, JSON.stringify(capture));
    await writeFile(join(dir, 'screen-1-large-text.json'), JSON.stringify(large));
    await writeFile(join(dir, 'screen-1-large-text.png'), await readFile(join(dir, 'screen-1.png')));
    const { sink } = capturingIo();

    await main(['scan', '--from-capture', captureFile, '--out', join(dir, 'large'), '--fail-on', 'never'], sink);

    const result = JSON.parse(await readFile(join(dir, 'large', 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.screens[0]?.largeText?.fontScale).toBe(2);
    expect(result.issues.find((issue) => issue.ruleId === 'text/scaling-truncation')?.resourceId).toBe(
      'seed-low-contrast',
    );
  });

  it('scans every screen a screens.json lists, under its name, and writes one for the next run', async () => {
    const captureFile = await writeFixtureCapture();
    await writeFile(join(dir, 'screen-2.json'), await readFile(captureFile));
    await writeFile(join(dir, 'screen-2.png'), await readFile(join(dir, 'screen-1.png')));
    const list = join(dir, 'screens.json');
    await writeFile(
      list,
      JSON.stringify({
        screens: [
          { name: 'Cart', capture: 'screen-1.json' },
          { name: 'Checkout', capture: 'screen-2.json' },
        ],
      }),
    );
    const { sink } = capturingIo();
    const out = join(dir, 'two');

    expect(await main(['scan', '--from-capture', list, '--out', out, '--fail-on', 'never'], sink)).toBe(0);

    const result = JSON.parse(await readFile(join(out, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.screens.map((screen) => [screen.id, screen.name])).toEqual([
      ['screen-1', 'Cart'],
      ['screen-2', 'Checkout'],
    ]);
    expect(result.issues.filter((issue) => issue.screenId === 'screen-1')).toHaveLength(3);
    expect(result.issues).toHaveLength(6);
    // The same element on two screens gives two issues that a baseline can tell apart.
    expect(new Set(result.issues.map((issue) => issue.fingerprint)).size).toBe(6);
    const report = await readFile(join(out, 'pragu-report.html'), 'utf8');
    expect(report).toContain('<h2 id="screen-2-heading">Checkout <span');
    expect(report).toContain('id="issue-6"');

    const again = join(dir, 'again');
    const rerunList = join(out, 'capture', 'screens.json');
    expect(await main(['scan', '--from-capture', rerunList, '--out', again, '--fail-on', 'never'], sink)).toBe(0);
    const rerun = JSON.parse(await readFile(join(again, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(rerun.issues.map((issue) => issue.fingerprint)).toEqual(result.issues.map((issue) => issue.fingerprint));
  });

  it('opens configured screens only when launching, and explains flags that conflict with them', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-cli-'));
    const configFile = join(dir, 'pragu.config.mjs');
    await writeFile(
      configFile,
      "export default { app: 'com.example.shop', screens: [{ name: 'Cart', deepLink: 'shop://cart' }] };\n",
    );
    const run = async (...args: string[]) => {
      const { io, sink } = capturingIo();
      const code = await main(['scan', '--config', configFile, ...args], sink);
      return { code, stderr: io.stderr };
    };

    const unknown = await run('--screen', 'Checkout');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('--screen "Checkout" is not one of the screens in pragu.config.ts.');
    expect(unknown.stderr).toContain('Known screens: Cart.');

    const named = await run('--screen-name', 'Cart');
    expect(named.code).toBe(2);
    expect(named.stderr).toContain('Use --screen <name> to scan one of them');

    const onShow = await run('--screen', 'Cart', '--no-launch');
    expect(onShow.code).toBe(2);
    expect(onShow.stderr).toContain('cannot be combined with --no-launch or --from-capture');

    const none = capturingIo();
    expect(await main(['scan', '--app', 'com.example.shop', '--screen', 'Cart'], none.sink)).toBe(2);
    expect(none.io.stderr).toContain('pragu.config.ts lists no screens');
  });

  it('renders the report again from a result and its kept screenshots', async () => {
    const captureFile = await writeFixtureCapture();
    const { sink } = capturingIo();
    const out = join(dir, 'scan');
    await main(['scan', '--from-capture', captureFile, '--out', out, '--fail-on', 'never'], sink);
    const original = await readFile(join(out, 'pragu-report.html'), 'utf8');

    const again = capturingIo();
    const copy = join(dir, 'again.html');
    expect(await main(['report', join(out, 'pragu-result.json'), '--out', copy], again.sink)).toBe(0);
    expect(again.io.stdout).toContain(`Report: ${copy}`);
    expect(await readFile(copy, 'utf8')).toBe(original);

    const resultFile = join(out, 'pragu-result.json');
    const old = JSON.parse(await readFile(resultFile, 'utf8')) as ScanResult;
    await writeFile(resultFile, JSON.stringify({ ...old, schemaVersion: '0.1.0' }));
    const stale = capturingIo();
    expect(await main(['report', resultFile], stale.sink)).toBe(2);
    expect(stale.io.stderr).toContain('uses result schema 0.1.0');

    const missing = capturingIo();
    expect(await main(['report'], missing.sink)).toBe(2);
    expect(missing.io.stderr).toContain('Tell Pragu which scan result to render.');
  });

  it('checks a screen that blocked screenshots by its tree alone, and says why contrast is missing', async () => {
    const captureFile = await writeFixtureCapture();
    await rm(join(dir, 'screen-1.png'));
    const { sink } = capturingIo();
    const out = join(dir, 'secure');

    await main(['scan', '--from-capture', captureFile, '--out', out, '--fail-on', 'never'], sink);

    const result = JSON.parse(await readFile(join(out, 'pragu-result.json'), 'utf8')) as ScanResult;
    expect(result.screens[0]?.screenshot).toBeNull();
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(['target/size', 'name/interactive-missing']);
    const report = await readFile(join(out, 'pragu-report.html'), 'utf8');
    expect(report).toContain('The app blocks screenshots on this screen (FLAG_SECURE');
    expect(report).toContain('No screenshot was captured for this screen.');
    expect(existsSync(join(out, 'capture', 'screen-1.png'))).toBe(false);
  });

  it('writes a report for sharing with --redact: no app text, covered screenshots, no raw captures', async () => {
    const captureFile = await writeFixtureCapture();
    const { sink } = capturingIo();
    const out = join(dir, 'shared');

    await main(['scan', '--from-capture', captureFile, '--out', out, '--fail-on', 'never', '--redact'], sink);

    const json = await readFile(join(out, 'pragu-result.json'), 'utf8');
    const result = JSON.parse(json) as ScanResult;
    expect(result.redacted).toBe(true);
    expect(result.issues).toHaveLength(3);
    const html = await readFile(join(out, 'pragu-report.html'), 'utf8');
    for (const text of ['Free shipping', 'Apply code', 'Dismiss promotion']) {
      expect(json).not.toContain(text);
      expect(html).not.toContain(text);
    }
    expect(html).toContain('Redacted for sharing');
    expect(existsSync(join(out, 'capture'))).toBe(false);
    expect(result.screens[0]?.screenshot?.file).toBe('screenshots/screen-1.png');
    const shot = PNG.sync.read(await readFile(join(out, 'screenshots', 'screen-1.png')));
    // The "Free shipping" text area is now the cover grey.
    const at = (shot.width * 270 + 200) * 4;
    expect([shot.data[at], shot.data[at + 1], shot.data[at + 2]]).toEqual([0x76, 0x76, 0x76]);

    const again = capturingIo();
    expect(await main(['report', join(out, 'pragu-result.json')], again.sink)).toBe(0);
    expect(await readFile(join(out, 'pragu-report.html'), 'utf8')).toBe(html);
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

describe('synced folders', () => {
  it('recognises the folders sync apps create, by path segment only', () => {
    expect(syncedFolder('C:\\Users\\ana\\OneDrive\\Desktop\\app')).toBe('OneDrive');
    expect(syncedFolder('/Users/ana/OneDrive - Contoso/app')).toBe('OneDrive');
    expect(syncedFolder('/Users/ana/Dropbox (Personal)/app')).toBe('Dropbox');
    expect(syncedFolder('/Users/ana/Library/Mobile Documents/com~apple~CloudDocs/app')).toBe('iCloud Drive');
    expect(syncedFolder('G:\\My Drive\\app')).toBe('Google Drive');
    expect(syncedFolder('reports', '/home/ana/dev/app')).toBeNull();
    expect(syncedFolder('/home/ana/onedrive-notes/app')).toBeNull();
  });

  it('warns with the folder, the service and the way out', () => {
    expect(syncedFolderWarning('out', '/Users/ana/Dropbox/app')).toMatch(
      /inside Dropbox, which uploads it\..*--out\.$/,
    );
    expect(syncedFolderWarning('out', '/home/ana/dev/app')).toBeNull();
  });
});

describe('report screenshots', () => {
  it('averages each target pixel over its source area, and leaves narrow images alone', () => {
    // 4 × 2: a black and a white column pair; halved, each target pixel is the mean of a 2 × 2 block.
    const data = new Uint8Array(4 * 2 * 4);
    for (let i = 0; i < 8; i++) data.set(i % 4 < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], i * 4);
    const small = downscale({ width: 4, height: 2, data }, 2);
    expect([small.width, small.height]).toEqual([2, 1]);
    expect([...small.data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    const odd = downscale(
      { width: 3, height: 1, data: new Uint8Array([0, 0, 0, 255, 90, 90, 90, 255, 30, 30, 30, 255]) },
      2,
    );
    expect(odd.width).toBe(2);
    expect(downscale({ width: 2, height: 1, data }, 720).width).toBe(2);
  });

  it('embeds a 1080 px capture at 720 px wide', () => {
    const png = new PNG({ width: 1080, height: 1920 });
    png.data.fill(200);
    const embedded = reportScreenshot(PNG.sync.write(png));
    const decoded = PNG.sync.read(Buffer.from(embedded.base64, 'base64'));
    expect([decoded.width, decoded.height]).toEqual([720, 1280]);
  });
});

describe('--verbose', () => {
  it('traces each command with its duration, also when it fails, and keeps tracing on a chosen device', async () => {
    const lines: string[] = [];
    // Node stands in for adb: "-e" runs the code that follows.
    const adb = new Adb(process.execPath, null, (line) => lines.push(line)).withSerial('emulator-5554');
    await adb.run(['-e', 'process.exit(0)']).catch(() => undefined);
    await expect(
      new Adb(process.execPath, null, (line) => lines.push(line)).run(['-e', 'process.exit(3)']),
    ).rejects.toThrow('failed');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^adb -e process\.exit\(0\) \(\d+ ms\)$/);
    expect(lines[1]).toMatch(/^adb -e process\.exit\(3\) \(\d+ ms\)$/);
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

describe('pragu.config.ts', () => {
  let dir = '';
  afterEach(async () => {
    if (dir !== '') await rm(dir, { recursive: true, force: true });
  });

  it('loads a TypeScript config, and works without one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-config-'));
    expect(await loadConfig(dir, undefined)).toEqual({ config: {}, file: null });
    await writeFile(
      join(dir, 'pragu.config.ts'),
      "const failOn: 'warning' = 'warning';\nexport default { app: 'com.example.shop', failOn };\n",
    );
    const { config, file } = await loadConfig(dir, undefined);
    expect(config).toEqual({ app: 'com.example.shop', failOn: 'warning' });
    expect(file).toBe(join(dir, 'pragu.config.ts'));
  });

  it('names the file and the field when a setting is wrong, and when a --config path is missing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-config-'));
    await writeFile(join(dir, 'pragu.config.mjs'), "export default { failOn: 'sometimes' };\n");
    await expect(loadConfig(dir, undefined)).rejects.toThrow('pragu.config.mjs: "failOn" must be one of');
    await expect(loadConfig(dir, 'nope.ts')).rejects.toThrow('The config file was not found: nope.ts');
  });

  it('pragu init writes a starter config and never overwrites one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-config-'));
    const file = await initConfig(dir);
    expect(await readFile(file, 'utf8')).toContain("import { defineConfig } from 'pragu';");
    await expect(initConfig(dir)).rejects.toThrow('This project already has pragu.config.ts.');
  });
});

describe('installing the agent', () => {
  const device = (failFirst: string | null) => {
    const calls: string[] = [];
    return {
      calls,
      run(args: string[]) {
        calls.push(args.join(' '));
        if (failFirst !== null && calls.length === 1) {
          return Promise.reject(new PraguError(3, `adb install failed: Failure [${failFirst}: ...]`));
        }
        return Promise.resolve('Success');
      },
    };
  };

  it('replaces an agent signed by another machine, which cannot be updated in place', async () => {
    const fake = device('INSTALL_FAILED_UPDATE_INCOMPATIBLE');
    await installAgent(fake, 'agent.apk');
    expect(fake.calls).toEqual(['install -r agent.apk', 'uninstall dev.pragu.agent', 'install agent.apk']);
  });

  it('leaves every other install failure alone', async () => {
    await expect(installAgent(device('INSTALL_FAILED_INSUFFICIENT_STORAGE'), 'agent.apk')).rejects.toThrow(
      'INSUFFICIENT_STORAGE',
    );
  });
});

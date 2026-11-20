import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Issue, ScanResult } from '@pragu/core';
import { afterEach, describe, expect, it } from 'vitest';
import { initWorkflow, starterWorkflow } from '../src/config.js';
import { makeLocator } from '../src/locate.js';
import { toolVersion } from '../src/version.js';

const PUSH_ONLY = "${{ github.event_name == 'push' && '--fail-on never' || ' ' }}";
const PUBLIC_ONLY_SARIF = "${{ github.event.repository.private && ' ' || '--format html,json,sarif' }}";

/** The emulator runner runs each script line as its own command, so the folded script must be one line. */
function scanCommand(workflow: string): string {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line.trimEnd().endsWith('script: >-'));
  expect(start).toBeGreaterThan(-1);
  const indent = (line: string) => line.length - line.trimStart().length;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || indent(line) <= indent(lines[start] ?? '')) break;
    body.push(line.trim());
  }
  return body.join(' ');
}

describe('the starter workflow from "pragu init --github"', () => {
  let dir = '';
  afterEach(async () => {
    if (dir !== '') await rm(dir, { recursive: true, force: true });
  });

  it('pins Pragu to the version that wrote it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-workflow-'));
    const workflow = await readFile(await initWorkflow(dir), 'utf8');
    expect(scanCommand(workflow)).toMatch(new RegExp(`^npx --yes pragu@${toolVersion().replaceAll('.', '\\.')} scan `));
    expect(workflow).not.toMatch(/npx --yes pragu(?!@)/);
  });

  it('never fails on findings on a push, so the default branch always leaves a scan to compare with', () => {
    const command = scanCommand(starterWorkflow('9.9.9'));
    expect(command).toContain(PUSH_ONLY);
    // --fail-on appears nowhere else, so pull requests keep failing on errors.
    expect(command.split('--fail-on').length - 1).toBe(1);
  });

  it('writes SARIF only on public repositories, next to --redact', () => {
    const command = scanCommand(starterWorkflow('9.9.9'));
    expect(command).toContain(PUBLIC_ONLY_SARIF);
    expect(command).toContain("${{ github.event.repository.private && ' ' || '--redact' }}");
    expect(command.split('--format').length - 1).toBe(1);
    expect(command).toMatch(/^npx --yes pragu@9\.9\.9 scan .* --out pragu-report \$\{\{/);
  });
});

describe('the GitHub Action', () => {
  const action = () => readFile(fileURLToPath(new URL('../../../action.yml', import.meta.url)), 'utf8');

  it('compares with the newest completed scan of main, whatever its conclusion', async () => {
    const text = await action();
    expect(text).not.toContain('--status success');
    expect(text).toContain('--status completed');
    expect(text).toContain('--name "$ARTIFACT"');
    expect(text).toContain('comparing with the baseline');
  });

  it('runs the Pragu version it was released with unless told otherwise', async () => {
    const text = await action();
    expect(text).toContain('jq -r .version "$GITHUB_ACTION_PATH/packages/cli/package.json"');
    expect(text).toContain('PRAGU="npx --yes pragu@$version"');
    expect(text).not.toMatch(/default: npx --yes pragu\s*$/m);
  });
});

describe('the SARIF location of issues that name no source line', () => {
  let dir = '';
  afterEach(async () => {
    if (dir !== '') await rm(dir, { recursive: true, force: true });
  });

  const result = { screens: [] } as unknown as ScanResult;
  const issue = { resourceId: null, screenId: 'screen-1' } as Issue;

  it('prefers the config, then package.json, app.json and the Gradle files; never report output', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pragu-locate-'));
    await mkdir(join(dir, 'android', 'app'), { recursive: true });
    const at = (config: string | null = null) => makeLocator(dir, config, result)(issue).uri;

    // Nothing committed: the config path the scan would have read.
    expect(at()).toBe('pragu.config.ts');

    // Added from the least preferred up, each new file wins.
    const order = [
      'settings.gradle.kts',
      'settings.gradle',
      'android/app/build.gradle.kts',
      'android/app/build.gradle',
      'app.json',
      'package.json',
    ];
    for (const file of order) {
      await writeFile(join(dir, file), '{}\n');
      expect(at()).toBe(file);
    }

    await writeFile(join(dir, 'pragu.config.mjs'), 'export default {};\n');
    expect(at(join(dir, 'pragu.config.mjs'))).toBe('pragu.config.mjs');
  });
});

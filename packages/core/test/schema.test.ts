import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  RESULT_SCHEMA_VERSION,
  analyze,
  defaultRules,
  normalizeAndroidCapture,
  parseAndroidCapture,
  summarize,
} from '../src/index.js';
import type { ScanResult } from '../src/index.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const schema = JSON.parse(readFileSync(join(root, 'packages/core/schema/pragu-result.schema.json'), 'utf8')) as {
  $id: string;
  properties: { schemaVersion: { const: string } };
};
const validate = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }).compile(schema);

/** Builds the result a scan would write, from a recording and its 200% capture. */
function resultFromRecording(dir: string, screenId: string): ScanResult {
  const read = (file: string) => readFileSync(join(dir, file));
  const capture = parseAndroidCapture(JSON.parse(read(`${screenId}.json`).toString('utf8')));
  const options = { screenId, screenName: screenId, screenshotFile: `${screenId}.png` };
  const { screen, device } = normalizeAndroidCapture(capture, options);
  const large = parseAndroidCapture(JSON.parse(read(`${screenId}-large-text.json`).toString('utf8')));
  const largeScreen = normalizeAndroidCapture(large, options).screen;
  screen.largeText = { fontScale: large.device.fontScale, windows: largeScreen.windows, nodes: largeScreen.nodes };
  // No pixels: the core package has no image decoder, and no schema field depends on them.
  const issues = analyze({ device, screens: [screen], rasters: new Map() });
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    tool: { name: 'pragu', version: '0.0.0' },
    startedAt: '2026-10-29T12:00:00.000Z',
    device,
    app: { id: capture.packageName },
    screens: [screen],
    issues,
    summary: summarize(issues, defaultRules),
  };
}

const recordings = ['rn-shop', 'android-compose'].flatMap((fixture) => {
  const dir = join(root, 'bench/recordings', fixture);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('-large-text.json'))
    .map((file) => [`${fixture} › ${file.replace('.json', '')}`, dir, file.replace('.json', '')] as const);
});

describe('pragu-result.schema.json', () => {
  it('carries the version the code writes', () => {
    expect(schema.properties.schemaVersion.const).toBe(RESULT_SCHEMA_VERSION);
    expect(schema.$id).toBe(`urn:pragu:result:${RESULT_SCHEMA_VERSION}`);
  });

  it.each(recordings)('accepts the result of a real scan: %s', (_name, dir, screenId) => {
    const result = resultFromRecording(dir, screenId);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects a field it does not describe, and a missing one, so code and schema cannot drift', () => {
    const [, dir, screenId] = recordings[0] ?? ['', '', ''];
    const result = resultFromRecording(dir, screenId);
    expect(validate({ ...result, extra: true })).toBe(false);
    const withoutSummary: Partial<ScanResult> = { ...result };
    delete withoutSummary.summary;
    expect(validate(withoutSummary)).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import { defaultRules, toSarif } from '../src/index.js';
import type { Issue, ScanResult } from '../src/index.js';

const schema = JSON.parse(
  readFileSync(new URL('./fixtures/sarif-schema-2.1.0.json', import.meta.url), 'utf8'),
) as object;
const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(schema);

function issue(overrides: Partial<Issue>): Issue {
  const rule = defaultRules.find((candidate) => candidate.meta.id === (overrides.ruleId ?? 'name/interactive-missing'));
  if (rule === undefined) throw new Error('known rule');
  return {
    ruleId: rule.meta.id,
    title: rule.meta.title,
    severity: rule.meta.severity,
    confidence: rule.meta.confidence,
    screenId: 'screen-1',
    nodeId: '0.1',
    resourceId: 'remove-item',
    fingerprint: 'abc123',
    message: 'This button has no accessible name.',
    whoIsAffected: rule.meta.whoIsAffected,
    whatTheyExperience: rule.meta.whatTheyExperience,
    wcag: rule.meta.wcag,
    en301549: rule.meta.en301549,
    boundsPx: { left: 0, top: 0, right: 10, bottom: 10 },
    evidence: { role: 'button' },
    fix: rule.meta.fix,
    inBaseline: false,
    ...overrides,
  };
}

function result(issues: Issue[], baseline = false): ScanResult {
  return {
    schemaVersion: '0.12.0',
    tool: { name: 'pragu', version: '0.1.0' },
    app: { id: 'com.example.shop' },
    redacted: false,
    screens: [{ id: 'screen-1', name: 'Cart' }],
    issues,
    summary: {
      rulesRun: ['name/interactive-missing', 'target/size', 'name/role-in-label'],
      baseline: baseline ? { file: 'b.json', newIssues: 1, known: 1, fixed: 0, fixedIssues: [] } : null,
    },
    score: { version: 1, value: 80, screens: {} },
  } as unknown as ScanResult;
}

const issues = [
  issue({}),
  issue({
    ruleId: 'target/size',
    severity: 'warning',
    resourceId: null,
    nodeId: '0.2',
    fingerprint: 'def456',
    inBaseline: true,
  }),
  issue({ ruleId: 'name/role-in-label', severity: 'info', nodeId: '0.3', fingerprint: 'ghi789' }),
];
const locate = (found: Issue) => ({
  uri: found.resourceId === null ? 'pragu.config.ts' : 'src/Cart.tsx',
  line: found.resourceId === null ? 3 : 41,
});
interface Log {
  runs: {
    tool: { driver: Record<string, unknown> & { rules: Record<string, unknown>[] } };
    results: Record<string, unknown>[];
  }[];
}
const sarif = (input: ScanResult) => toSarif(input, locate) as unknown as Log;

describe('toSarif (SARIF 2.1.0)', () => {
  it('describes Pragu as the tool, with its version and repository', () => {
    const driver = sarif(result(issues)).runs[0]?.tool.driver;
    expect(driver).toMatchObject({
      name: 'Pragu',
      version: '0.1.0',
      informationUri: 'https://github.com/FlorentLatifi/Pragu',
    });
  });

  it('lists every rule that ran as a reportingDescriptor with title, who is affected, fixes and WCAG tags', () => {
    const rules = sarif(result(issues)).runs[0]?.tool.driver.rules ?? [];
    expect(rules.map((rule) => rule.id)).toEqual(['name/interactive-missing', 'target/size', 'name/role-in-label']);
    expect(rules[0]).toMatchObject({ shortDescription: { text: 'Interactive element has no accessible name' } });
    expect(JSON.stringify(rules[0])).toContain('React Native:');
    expect(rules[0]?.properties).toMatchObject({ tags: ['accessibility', 'wcag-4.1.2'] });
  });

  it('maps severity to level: error → error, warning → warning, info → note', () => {
    expect(sarif(result(issues)).runs[0]?.results.map((found) => found.level)).toEqual(['error', 'warning', 'note']);
  });

  it('puts the issue fingerprint in partialFingerprints["pragu/v1"]', () => {
    expect(sarif(result(issues)).runs[0]?.results[0]?.partialFingerprints).toEqual({ 'pragu/v1': 'abc123' });
  });

  it('sets baselineState to new or unchanged when the scan used a baseline, and leaves it out otherwise', () => {
    expect(sarif(result(issues, true)).runs[0]?.results.map((found) => found.baselineState)).toEqual([
      'new',
      'unchanged',
      'new',
    ]);
    expect(sarif(result(issues)).runs[0]?.results[0]).not.toHaveProperty('baselineState');
  });

  it('gives every result a location GitHub code scanning accepts', () => {
    const [first, second] = sarif(result(issues)).runs[0]?.results ?? [];
    expect(first?.locations).toEqual([
      {
        physicalLocation: {
          artifactLocation: { uri: 'src/Cart.tsx' },
          region: { startLine: 41, startColumn: 1, endLine: 41, endColumn: 1 },
        },
        message: { text: 'Cart › remove-item' },
      },
    ]);
    expect(JSON.stringify(second?.locations)).toContain('pragu.config.ts');
  });

  it('is deterministic: the same result always gives the same SARIF (golden file)', async () => {
    const text = `${JSON.stringify(toSarif(result(issues, true), locate), null, 2)}\n`;
    expect(`${JSON.stringify(toSarif(result(issues, true), locate), null, 2)}\n`).toBe(text);
    await expect(text).toMatchFileSnapshot('./__snapshots__/pragu.sarif');
  });

  it('validates against the official SARIF 2.1.0 JSON Schema', () => {
    const valid = validate(toSarif(result(issues, true), locate));
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { applyConfig, defaultRules, defineConfig, enabledRules, parseConfig } from '../src/index.js';
import type { Issue } from '../src/index.js';

const issue = (overrides: Partial<Issue>): Issue => ({
  ruleId: 'contrast/text',
  title: 'Text contrast is too low',
  severity: 'error',
  confidence: 'high',
  screenId: 'screen-1',
  nodeId: '0.1',
  resourceId: 'promo-banner',
  fingerprint: 'f',
  message: 'm',
  whoIsAffected: 'w',
  whatTheyExperience: 'e',
  wcag: ['1.4.3'],
  en301549: [],
  boundsPx: { left: 0, top: 0, right: 10, bottom: 10 },
  evidence: {},
  fix: { reactNative: '', compose: '', androidViews: '' },
  inBaseline: false,
  ...overrides,
});

describe('parseConfig', () => {
  it('accepts a full config and returns it unchanged, as defineConfig does', () => {
    const config = defineConfig({
      app: 'com.example.shop',
      out: 'reports',
      failOn: 'warning',
      checkFontScale: true,
      baseline: 'pragu-baseline.json',
      rules: { 'target/size': 'error', 'contrast/text': 'off' },
      ignore: [{ rule: 'contrast/text', resourceId: 'promo-banner', reason: 'Brand colours; fix tracked in #123' }],
    });
    expect(parseConfig(config, 'pragu.config.ts')).toBe(config);
  });

  it.each([
    [null, 'the default export must be a config object'],
    [{ colour: 'red' }, 'unknown setting "colour"'],
    [{ app: '' }, '"app" must be a non-empty string'],
    [{ failOn: 'sometimes' }, '"failOn" must be one of error, warning, info, never'],
    [{ checkFontScale: 'yes' }, '"checkFontScale" must be true or false'],
    [{ rules: { 'name/missing': 'off' } }, 'unknown rule "name/missing"'],
    [{ rules: { 'target/size': 'loud' } }, '"rules.target/size" must be "off", "error", "warning" or "info"'],
    [{ ignore: {} }, '"ignore" must be an array'],
    [{ ignore: [{ reason: 'too broad' }] }, 'an entry matching everything would hide every issue'],
    [{ ignore: [{ rule: 'contrast/text' }] }, 'needs a "reason"'],
  ])('rejects %j: %s', (value, message) => {
    expect(() => parseConfig(value, 'pragu.config.ts')).toThrow(message);
  });
});

describe('enabledRules', () => {
  it('runs every rule the config does not turn off', () => {
    const rules = enabledRules({ rules: { 'contrast/text': 'off', 'target/size': 'error' } });
    expect(rules.map((rule) => rule.meta.id)).not.toContain('contrast/text');
    expect(rules).toHaveLength(defaultRules.length - 1);
  });
});

describe('applyConfig', () => {
  const names = new Map([['screen-1', 'Cart']]);

  it('applies severity overrides', () => {
    const { issues } = applyConfig(
      [issue({ ruleId: 'target/size', severity: 'warning' })],
      { rules: { 'target/size': 'error' } },
      names,
    );
    expect(issues[0]?.severity).toBe('error');
  });

  it('sets aside issues that match every field of an ignore entry, and keeps the rest', () => {
    const config = defineConfig({ ignore: [{ rule: 'contrast/text', screen: 'Cart', reason: 'Brand colours' }] });
    const { issues, ignored } = applyConfig(
      [issue({}), issue({ ruleId: 'name/interactive-missing' }), issue({ screenId: 'screen-2' })],
      config,
      names,
    );
    expect(ignored).toHaveLength(1);
    expect(issues.map((kept) => kept.ruleId)).toEqual(['name/interactive-missing', 'contrast/text']);
  });
});

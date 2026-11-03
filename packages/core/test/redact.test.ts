import { describe, expect, it } from 'vitest';
import { REDACTED, coverText, redactMessage, redactResult } from '../src/index.js';
import type { Issue, ScanResult } from '../src/index.js';
import { createRaster, pamNode, rect, screenOf } from './helpers.js';

function issueOn(nodeId: string, overrides: Partial<Issue>): Issue {
  return {
    ruleId: 'contrast/text',
    title: 'Text contrast is too low',
    severity: 'error',
    confidence: 'high',
    screenId: 'screen-1',
    nodeId,
    resourceId: 'balance',
    fingerprint: 'abc',
    message: '"Balance 1,204 EUR" has a contrast of 2.1:1 (#B0B0B0 on #FFFFFF).',
    whoIsAffected: '',
    whatTheyExperience: '',
    wcag: ['1.4.3'],
    en301549: [],
    boundsPx: rect(0, 0, 10, 10),
    evidence: { ratio: 2.1, foreground: '#B0B0B0', name: 'Ana Krasniqi' },
    fix: { reactNative: '', compose: '', androidViews: '' },
    inBaseline: false,
    ...overrides,
  };
}

describe('redactResult', () => {
  const screen = screenOf([
    pamNode({ id: '0.0', name: 'Ana Krasniqi', text: 'Ana Krasniqi', hint: null }),
    pamNode({ id: '0.1', name: null, text: null, hint: 'IBAN' }),
  ]);
  const result = {
    redacted: false,
    screens: [{ ...screen, windows: screen.windows.map((window) => ({ ...window, title: 'Account of Ana' })) }],
    issues: [issueOn('0.0', {})],
    summary: { baseline: null },
  } as unknown as ScanResult;

  it('replaces names, texts, hints, window titles, quotes and text evidence, and keeps what a fix needs', () => {
    const redacted = redactResult(result);
    expect(redacted.redacted).toBe(true);
    const [named, field] = redacted.screens[0]?.nodes ?? [];
    expect([named?.name, named?.text, field?.name, field?.hint]).toEqual([REDACTED, REDACTED, null, REDACTED]);
    expect(redacted.screens[0]?.windows[0]?.title).toBe(REDACTED);
    const issue = redacted.issues[0];
    expect(issue?.message).toBe(`"${REDACTED}" has a contrast of 2.1:1 (#B0B0B0 on #FFFFFF).`);
    expect(issue?.evidence).toEqual({ ratio: 2.1, foreground: '#B0B0B0', name: REDACTED });
    expect([issue?.resourceId, issue?.fingerprint]).toEqual(['balance', 'abc']);
    expect(JSON.stringify(redacted)).not.toContain('Ana');
    expect(result.redacted).toBe(false);
  });

  it('keeps the role words Pragu itself quotes', () => {
    expect(
      redactMessage('A screen reader announces only "Edit box": the text "Name" next to it is not connected.'),
    ).toBe(`A screen reader announces only "Edit box": the text "${REDACTED}" next to it is not connected.`);
  });
});

describe('coverText', () => {
  it('paints over text and hints in the app window, and nothing else', () => {
    const raster = createRaster(20, 10, 0xffffff);
    const screen = screenOf([
      pamNode({ id: '0.0', text: 'Ana', boundsPx: rect(0, 0, 5, 5) }),
      pamNode({ id: '0.1', text: null, hint: 'IBAN', boundsPx: rect(10, 0, 15, 5) }),
      pamNode({ id: '0.2', text: null, boundsPx: rect(0, 5, 20, 10) }),
    ]);
    coverText(raster, screen);
    const at = (x: number, y: number) => [...raster.data.slice((y * 20 + x) * 4, (y * 20 + x) * 4 + 3)];
    expect(at(2, 2)).toEqual([0x76, 0x76, 0x76]);
    expect(at(12, 2)).toEqual([0x76, 0x76, 0x76]);
    expect(at(2, 7)).toEqual([255, 255, 255]);
  });
});

import { RESULT_SCHEMA_VERSION } from '@pragu/core';
import type { Issue, ScanResult } from '@pragu/core';
import { describe, expect, it } from 'vitest';
import { escapeHtml, measurement, renderReport, screenNotes } from '../src/index.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    ruleId: 'name/interactive-missing',
    title: 'Interactive element has no accessible name',
    severity: 'error',
    confidence: 'high',
    screenId: 'screen-1',
    nodeId: '0.3',
    resourceId: 'seed-unlabeled-remove',
    fingerprint: '0123456789abcdef',
    message: 'This button has no accessible name. A screen reader can only announce "Button".',
    whoIsAffected: 'People who use a screen reader.',
    whatTheyExperience: 'They cannot tell what it does.',
    wcag: ['4.1.2'],
    en301549: ['11.4.1.2'],
    boundsPx: { left: 108, top: 240, right: 216, bottom: 480 },
    evidence: { role: 'button' },
    fix: {
      reactNative: 'Add accessibilityLabel.',
      compose: 'Give the icon a contentDescription.',
      androidViews: 'Set android:contentDescription.',
    },
    ...overrides,
  };
}

function result(issues: Issue[]): ScanResult {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    tool: { name: 'pragu', version: '0.0.0' },
    startedAt: '2026-10-27T12:00:00.000Z',
    device: {
      platform: 'android',
      osVersion: '16',
      apiLevel: 36,
      manufacturer: 'Google',
      model: 'sdk_gphone64_x86_64',
      densityDpi: 420,
      fontScale: 1,
      locale: 'en-US',
      nightMode: false,
      screenWidthPx: 1080,
      screenHeightPx: 2400,
    },
    app: { id: 'dev.pragu.fixtures.rnshop' },
    screens: [
      {
        id: 'screen-1',
        name: 'Cart',
        appId: 'dev.pragu.fixtures.rnshop',
        screenshot: { file: 'screen-1.png', widthPx: 1080, heightPx: 2400 },
        windows: [
          { kind: 'app', title: 'rn-shop', boundsPx: { left: 0, top: 0, right: 1080, bottom: 2400 }, foreground: true },
        ],
        nodes: [],
        largeText: null,
      },
    ],
    issues,
    summary: {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
      rulesRun: ['name/interactive-missing', 'contrast/text', 'target/size'],
    },
  };
}

const screenshots = new Map([['screen-1', { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' }]]);

describe('renderReport', () => {
  it('matches the golden report', async () => {
    const html = renderReport({
      result: result([
        issue(),
        issue({
          ruleId: 'target/size',
          title: 'Touch target is too small',
          severity: 'warning',
          confidence: 'medium',
          resourceId: null,
          wcag: ['2.5.8'],
          en301549: [],
        }),
      ]),
      screenshots,
    });
    await expect(html).toMatchFileSnapshot('./__snapshots__/report.html');
  });

  it('places numbered markers in screenshot percentages', () => {
    const html = renderReport({ result: result([issue()]), screenshots });
    expect(html).toContain('style="left:10.000%;top:10.000%;width:10.000%;height:10.000%"');
    expect(html).toContain('href="#issue-1"');
    expect(html).toContain('aria-label="Issue 1: Interactive element has no accessible name"');
    expect(html).toContain('id="issue-1"');
  });

  it('spells out severity and standards instead of relying on colour', () => {
    const html = renderReport({ result: result([issue()]), screenshots });
    expect(html).toContain('<span class="severity severity-error">Error</span>');
    expect(html).toContain('<span>WCAG 4.1.2</span>');
    expect(html).toContain('<span>EN 301 549 11.4.1.2</span>');
  });

  it('gives the fix for each toolkit, and skips a toolkit without one', () => {
    const fix = {
      reactNative: 'Add accessibilityLabel.',
      compose: '',
      androidViews: 'Set android:contentDescription.',
    };
    const html = renderReport({ result: result([issue({ fix })]), screenshots });
    expect(html).toContain('<dt>Fix in React Native</dt><dd>Add accessibilityLabel.</dd>');
    expect(html).toContain('<dt>Fix in Android Views</dt><dd>Set android:contentDescription.</dd>');
    expect(html).not.toContain('Fix in Jetpack Compose');
  });

  it('is self-contained: no external scripts, styles, fonts or images', () => {
    const html = renderReport({ result: result([issue()]), screenshots });
    expect(html).not.toMatch(/(src|href)="https?:/);
    // Fonts are embedded as data: URLs; anything else would be a network request.
    expect(html).not.toMatch(/@import|url\((?!data:)/);
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });

  it('escapes text that comes from the scanned app', () => {
    const hostile = issue({ message: '<img src=x onerror=alert(1)>', resourceId: '"><script>' });
    const html = renderReport({ result: result([hostile]), screenshots });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('"><script>');
  });

  it('gives an empty screen a clear next step instead of a blank', () => {
    const html = renderReport({ result: result([]), screenshots });
    expect(html).toContain('<h1>No barriers found by 3 automated checks</h1>');
    expect(html).toContain('try it with TalkBack next');
  });

  it('says so when a screen has no screenshot', () => {
    const html = renderReport({ result: result([issue()]), screenshots: new Map() });
    expect(html).toContain('No screenshot was captured for this screen.');
  });

  it('states the limits of automated checks', () => {
    const html = renderReport({ result: result([issue()]), screenshots });
    expect(html).toContain('not a compliance statement');
  });

  it('says when a dialog, the keyboard or web content limited what was checked', () => {
    const base = result([issue()]);
    const screen = base.screens[0];
    if (screen === undefined) throw new Error('fixture has a screen');
    const full = { left: 0, top: 0, right: 1080, bottom: 2400 };
    const limited = {
      ...screen,
      windows: [
        { kind: 'app' as const, title: 'rn-shop', boundsPx: full, foreground: false },
        { kind: 'app' as const, title: 'Remove?', boundsPx: full, foreground: true },
        { kind: 'keyboard' as const, title: null, boundsPx: { ...full, top: 1500 }, foreground: false },
      ],
      nodes: [{ inWebView: true } as ScanResult['screens'][number]['nodes'][number]],
    };
    expect(screenNotes(limited)).toEqual([
      'A dialog or popup was open, so only its content was checked.',
      'The keyboard was open; elements it covered were not checked.',
      'This screen contains web content (a WebView). Pragu checks native UI only; test web content with a web tool such as axe-core.',
    ]);
    const html = renderReport({ result: { ...base, screens: [limited] }, screenshots });
    expect(html).toContain('<ul class="notes"><li>A dialog or popup was open');
    expect(screenNotes(screen)).toEqual([]);
  });

  it('says when the screen was also checked at 200% text size', () => {
    const screen = result([issue()]).screens[0];
    if (screen === undefined) throw new Error('fixture has a screen');
    expect(screenNotes({ ...screen, largeText: { fontScale: 2, windows: [], nodes: [] } })).toEqual([
      'Also captured at 200% text size, to find text that gets cut off.',
    ]);
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('measurement', () => {
  it('prints the evidence a developer needs on the screenshot, like a dimension on a drawing', () => {
    expect(measurement(issue({ ruleId: 'target/size', evidence: { widthDp: 16, heightDp: 16 } }))).toBe('16 × 16 dp');
    expect(measurement(issue({ ruleId: 'contrast/text', evidence: { ratio: 2.52 } }))).toBe('2.52 : 1');
    expect(measurement(issue({ ruleId: 'name/interactive-missing' }))).toBe('no name');
    expect(measurement(issue({ ruleId: 'state/not-exposed' }))).toBe('no state');
    expect(measurement(issue({ ruleId: 'text/scaling-truncation' }))).toBe('cut at 200%');
  });

  it('prints nothing when the evidence is missing or the rule has nothing to measure', () => {
    expect(measurement(issue({ ruleId: 'target/size', evidence: {} }))).toBeNull();
    expect(measurement(issue({ ruleId: 'contrast/text', evidence: {} }))).toBeNull();
    expect(measurement(issue({ ruleId: 'some/future-rule' }))).toBeNull();
  });

  it('gives each marker one sign with its number and measurement, never on top of another', () => {
    const near = issue({ boundsPx: { left: 120, top: 240, right: 228, bottom: 480 } });
    const top = issue({ boundsPx: { left: 100, top: 20, right: 300, bottom: 90 } });
    const html = renderReport({ result: result([issue(), near, top]), screenshots });
    expect(html).toContain('<span class="sign-number">1</span><span class="sign-measure">no name</span>');
    const tops = [...html.matchAll(/class="screen-sign" style="left:[\d.]+%;top:([\d.-]+)%"/g)].map((m) =>
      Number(m[1]),
    );
    expect(tops).toHaveLength(3);
    expect(tops[1]).toBeLessThan(tops[0] ?? 0);
    expect(tops[2]).toBeGreaterThan(90 / 24);
  });
});

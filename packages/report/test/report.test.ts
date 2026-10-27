import { RESULT_SCHEMA_VERSION } from '@pragu/core';
import type { Issue, ScanResult } from '@pragu/core';
import { describe, expect, it } from 'vitest';
import { escapeHtml, renderReport } from '../src/index.js';

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
    fix: { reactNative: 'Add accessibilityLabel.', compose: '', androidViews: '' },
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
        nodes: [],
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

  it('is self-contained: no external scripts, styles, fonts or images', () => {
    const html = renderReport({ result: result([issue()]), screenshots });
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import|url\(/);
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
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

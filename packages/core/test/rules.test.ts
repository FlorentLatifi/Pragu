import { describe, expect, it } from 'vitest';
import {
  inputMissingLabel,
  interactiveMissingName,
  requiredTextRatio,
  targetSize,
  textContrast,
} from '../src/index.js';
import { createRaster, device, paintText, pamNode, rect, screenOf } from './helpers.js';

describe('name/interactive-missing', () => {
  const check = (nodes: Parameters<typeof screenOf>[0]) =>
    interactiveMissingName.check({ screen: screenOf(nodes), device, raster: null });

  it('flags an icon-only button and says what the screen reader announces', () => {
    const findings = check([pamNode({ id: '0', name: null })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe(
      'This button has no accessible name. A screen reader can only announce "Button".',
    );
    expect(findings[0]?.evidence).toEqual({ role: 'button', platformRole: 'android.widget.Button' });
  });

  it('explains unnamed controls that have no spoken role', () => {
    const findings = check([pamNode({ id: '0', name: null, role: 'container' })]);
    expect(findings[0]?.message).toContain('can only say that it can be activated');
  });

  it('leaves named, decorative, hidden and off-screen elements alone', () => {
    const findings = check([
      pamNode({ id: '0' }),
      pamNode({ id: '1', name: null, interactive: false, role: 'image' }),
      pamNode({ id: '2', name: null, exposedToAssistiveTech: false }),
      pamNode({ id: '3', name: null, visible: false }),
    ]);
    expect(findings).toEqual([]);
  });

  it('leaves text fields to the input/missing-label rule', () => {
    expect(check([pamNode({ id: '0', name: null, role: 'textfield' })])).toEqual([]);
  });
});

describe('input/missing-label', () => {
  const check = (nodes: Parameters<typeof screenOf>[0]) =>
    inputMissingLabel.check({ screen: screenOf(nodes), device, raster: null });
  const field = (overrides: Partial<Parameters<typeof pamNode>[0]> = {}) =>
    pamNode({
      id: 'f',
      role: 'textfield',
      platformRole: 'android.widget.EditText',
      name: null,
      boundsDp: rect(16, 100, 396, 148),
      ...overrides,
    });
  const text = (id: string, words: string, boundsDp: ReturnType<typeof rect>) =>
    pamNode({ id, role: 'text', interactive: false, text: words, name: words, boundsDp });

  it('flags a field without a label and names the text a sighted person reads as its label', () => {
    const findings = check([
      text('0', 'Delivery details', rect(16, 20, 300, 56)),
      text('1', 'Promo code', rect(16, 76, 120, 96)),
      field(),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe(
      'This text field has no label. A screen reader announces only "Edit box": the text "Promo code" next to it is not connected to it.',
    );
    expect(findings[0]?.evidence).toEqual({ platformRole: 'android.widget.EditText', visibleText: 'Promo code' });
  });

  it('finds a label to the left of the field, and says so plainly when there is none', () => {
    const beside = check([text('0', 'Code', rect(0, 110, 12, 130)), field()]);
    expect(beside[0]?.evidence.visibleText).toBe('Code');
    const alone = check([text('0', 'Far away', rect(16, 0, 120, 20)), field()]);
    expect(alone[0]?.message).toBe(
      'This text field has no label. A screen reader announces only "Edit box", so people have to guess what to enter.',
    );
    expect(alone[0]?.evidence).toEqual({ platformRole: 'android.widget.EditText' });
  });

  it('leaves labelled, hidden, off-screen and web fields alone', () => {
    expect(
      check([
        field({ id: '0', name: 'Email' }),
        field({ id: '1', exposedToAssistiveTech: false }),
        field({ id: '2', visible: false }),
        field({ id: '3', inWebView: true }),
      ]),
    ).toEqual([]);
  });
});

describe('requiredTextRatio', () => {
  it.each([
    [14, 4.5, 'high'],
    [18.66, 3, 'medium'],
    [20, 3, 'medium'],
    [24, 3, 'high'],
    [32, 3, 'high'],
  ] as const)('text of %s dp needs %s:1 with %s confidence', (size, required, confidence) => {
    expect(requiredTextRatio(size, 40)).toEqual({ required, confidence });
  });

  it('bounds an unknown text size by the element height, with medium confidence', () => {
    expect(requiredTextRatio(null, 16)).toEqual({ required: 4.5, confidence: 'medium' });
    expect(requiredTextRatio(null, 20)).toEqual({ required: 3, confidence: 'medium' });
    expect(requiredTextRatio(null, 33)).toEqual({ required: 3, confidence: 'medium' });
  });
});

describe('contrast/text', () => {
  const textNode = (overrides: Partial<Parameters<typeof pamNode>[0]> = {}) =>
    pamNode({
      id: '0',
      role: 'text',
      interactive: false,
      text: 'Free shipping on orders over €50',
      name: 'Free shipping on orders over €50',
      boundsDp: rect(10, 10, 190, 50),
      textSizeDp: 14,
      ...overrides,
    });

  function rasterWithText(ink: number) {
    const raster = createRaster(200, 60, 0xffffff);
    paintText(raster, rect(10, 10, 190, 50), ink, 0xe0e0e0);
    return raster;
  }

  it('flags grey text that does not reach 4.5:1', () => {
    const findings = textContrast.check({ screen: screenOf([textNode()]), device, raster: rasterWithText(0xa3a3a3) });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe(
      '"Free shipping on orders over €50" has a contrast of 2.52:1 (#A3A3A3 on #FFFFFF); text this size needs 4.5:1.',
    );
    expect(findings[0]?.evidence).toEqual({
      ratio: 2.52,
      required: 4.5,
      foreground: '#A3A3A3',
      background: '#FFFFFF',
      textSizeDp: 14,
    });
    expect(findings[0]?.confidence).toBe('high');
  });

  it('passes text that reaches 4.5:1', () => {
    const raster = rasterWithText(0x595959);
    expect(textContrast.check({ screen: screenOf([textNode()]), device, raster })).toEqual([]);
  });

  it('applies the 3:1 large-text threshold to text of 24 dp or more', () => {
    const raster = rasterWithText(0x949494); // about 3.03:1 on white
    expect(textContrast.check({ screen: screenOf([textNode({ textSizeDp: 28 })]), device, raster })).toEqual([]);
    expect(textContrast.check({ screen: screenOf([textNode({ textSizeDp: 14 })]), device, raster })).toHaveLength(1);
  });

  it('reports with medium confidence when the text size is unknown', () => {
    const findings = textContrast.check({
      screen: screenOf([textNode({ textSizeDp: null })]),
      device,
      raster: rasterWithText(0xa3a3a3),
    });
    expect(findings[0]?.confidence).toBe('medium');
    expect(findings[0]?.evidence.textSizeDp).toBe('unknown');
    expect(findings[0]?.message).toBe(
      '"Free shipping on orders over €50" has a contrast of 2.52:1 (#A3A3A3 on #FFFFFF); even large text needs 3:1.',
    );
  });

  it('holds text of unknown size to 4.5:1 only when its element is too short for large text (Compose)', () => {
    const raster = rasterWithText(0x949494); // about 3.03:1 on white
    const short = textNode({ textSizeDp: null, boundsDp: rect(10, 10, 190, 26) });
    const tall = textNode({ textSizeDp: null, boundsDp: rect(10, 10, 190, 50) });
    expect(textContrast.check({ screen: screenOf([short]), device, raster })).toHaveLength(1);
    expect(textContrast.check({ screen: screenOf([tall]), device, raster })).toEqual([]);
  });

  it('skips screens without pixels, nodes without text, invisible text and busy backgrounds', () => {
    const raster = rasterWithText(0xa3a3a3);
    expect(textContrast.check({ screen: screenOf([textNode()]), device, raster: null })).toEqual([]);
    expect(textContrast.check({ screen: screenOf([textNode({ text: null })]), device, raster })).toEqual([]);
    expect(textContrast.check({ screen: screenOf([textNode({ visible: false })]), device, raster })).toEqual([]);
    const blank = createRaster(200, 60, 0xffffff);
    expect(textContrast.check({ screen: screenOf([textNode()]), device, raster: blank })).toEqual([]);
  });

  it('exempts text inside a disabled control, as WCAG 1.4.3 does, but still checks enabled ones', () => {
    const raster = rasterWithText(0xa3a3a3);
    const button = (enabled: boolean) =>
      pamNode({ id: '0', role: 'button', enabled, childIds: ['0.0'], boundsDp: rect(0, 0, 200, 60) });
    const label = textNode({ id: '0.0', parentId: '0' });
    expect(textContrast.check({ screen: screenOf([button(false), label]), device, raster })).toEqual([]);
    expect(textContrast.check({ screen: screenOf([button(true), label]), device, raster })).toHaveLength(1);
  });

  it('does not trust the pixels of text partly covered by another window, or judge web content', () => {
    const raster = rasterWithText(0xa3a3a3);
    expect(textContrast.check({ screen: screenOf([textNode({ obscured: true })]), device, raster })).toEqual([]);
    expect(textContrast.check({ screen: screenOf([textNode({ inWebView: true })]), device, raster })).toEqual([]);
  });
});

describe('rule scope', () => {
  it('leaves web content to web tools in the name and target rules too', () => {
    const webButton = pamNode({ id: '0', name: null, inWebView: true });
    expect(interactiveMissingName.check({ screen: screenOf([webButton]), device, raster: null })).toEqual([]);
    const crowded = [
      pamNode({ id: '0', boundsDp: rect(100, 100, 200, 148) }),
      pamNode({ id: '1', boundsDp: rect(202, 116, 218, 132), inWebView: true }),
    ];
    expect(targetSize.check({ screen: screenOf(crowded), device, raster: null })).toEqual([]);
  });
});

describe('target/size', () => {
  const check = (nodes: Parameters<typeof screenOf>[0]) =>
    targetSize.check({ screen: screenOf(nodes), device, raster: null });

  it('flags a 16 dp target squeezed next to another target', () => {
    const findings = check([
      pamNode({ id: '0', name: 'Apply code', boundsDp: rect(100, 100, 200, 148) }),
      pamNode({ id: '1', name: 'Dismiss promotion', boundsDp: rect(202, 116, 218, 132) }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.node.id).toBe('1');
    expect(findings[0]?.evidence).toEqual({ widthDp: 16, heightDp: 16, minimumDp: 24, nearestTargetGapDp: 2 });
    expect(findings[0]?.message).toBe(
      'This target is 16×16 dp and another target is 2 dp away. It needs to be at least 24×24 dp, or have that much space around it.',
    );
  });

  it('accepts an undersized target with 24 dp of space around it (WCAG spacing exception)', () => {
    const findings = check([
      pamNode({ id: '0', boundsDp: rect(0, 0, 48, 48) }),
      pamNode({ id: '1', boundsDp: rect(100, 100, 116, 116) }),
    ]);
    expect(findings).toEqual([]);
  });

  it('accepts large targets and ignores disabled, invisible, hidden and static elements', () => {
    expect(
      check([
        pamNode({ id: '0', boundsDp: rect(0, 0, 48, 48) }),
        pamNode({ id: '1', boundsDp: rect(50, 0, 60, 10), enabled: false }),
        pamNode({ id: '2', boundsDp: rect(50, 0, 60, 10), visible: false }),
        pamNode({ id: '3', boundsDp: rect(50, 0, 60, 10), exposedToAssistiveTech: false }),
        pamNode({ id: '4', boundsDp: rect(50, 0, 60, 10), interactive: false }),
      ]),
    ).toEqual([]);
  });

  it('does not count a clickable parent row as a neighbouring target', () => {
    const findings = check([
      pamNode({ id: '0', boundsDp: rect(0, 0, 400, 60) }),
      pamNode({ id: '0.0', boundsDp: rect(300, 20, 316, 36) }),
    ]);
    expect(findings).toEqual([]);
  });

  it('flags two undersized targets whose spacing circles overlap, and accepts them far apart', () => {
    const close = check([
      pamNode({ id: '0', boundsDp: rect(0, 0, 16, 16) }),
      pamNode({ id: '1', boundsDp: rect(20, 0, 36, 16) }),
    ]);
    expect(close.map((finding) => finding.node.id)).toEqual(['0', '1']);

    const apart = check([
      pamNode({ id: '0', boundsDp: rect(0, 0, 16, 16) }),
      pamNode({ id: '1', boundsDp: rect(40, 0, 56, 16) }),
    ]);
    expect(apart).toEqual([]);
  });

  it('stays silent where two Compose touch areas meet, but not where drawn areas do', () => {
    // Recorded on the Compose fixture: two 20 dp icons 2 dp apart, reported as touch areas
    // of 22×48 and 48×48 dp. On the device each one accepts touches well beyond 24 dp.
    const neighbours = (boundsAreTouchArea: boolean) =>
      check([
        pamNode({ id: '0', boundsDp: rect(339, 353, 361, 401), boundsAreTouchArea }),
        pamNode({ id: '1', boundsDp: rect(361, 353, 409, 401), boundsAreTouchArea }),
      ]);
    expect(neighbours(true)).toEqual([]);
    expect(neighbours(false).map((finding) => finding.node.id)).toEqual(['0']);
  });
});

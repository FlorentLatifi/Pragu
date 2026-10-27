import { describe, expect, it } from 'vitest';
import { accessibleName, androidRole, normalizeAndroidCapture, parseAndroidCapture } from '../src/index.js';
import { captureOf, rawNode } from './helpers.js';

describe('androidRole', () => {
  it.each([
    ['android.widget.ImageButton', 'button'],
    ['androidx.appcompat.widget.AppCompatImageButton', 'button'],
    ['android.widget.Button', 'button'],
    ['com.google.android.material.button.MaterialButton', 'button'],
    ['android.widget.CheckBox', 'checkbox'],
    ['android.widget.RadioButton', 'radio'],
    ['androidx.appcompat.widget.SwitchCompat', 'switch'],
    ['android.widget.EditText', 'textfield'],
    ['android.widget.SeekBar', 'slider'],
    ['android.widget.ImageView', 'image'],
    ['android.widget.TextView', 'text'],
    ['androidx.recyclerview.widget.RecyclerView', 'list'],
    ['android.view.ViewGroup', 'container'],
  ])('maps %s to %s', (className, role) => {
    expect(androidRole(rawNode({ className }))).toBe(role);
  });

  it('prefers a role description, which React Native and Compose use for links and tabs', () => {
    expect(androidRole(rawNode({ className: 'android.view.ViewGroup', roleDescription: 'Link' }))).toBe('link');
    expect(androidRole(rawNode({ roleDescription: ' tab ' }))).toBe('tab');
  });

  it('falls back to the class name for an unknown role description', () => {
    expect(androidRole(rawNode({ className: 'android.widget.Button', roleDescription: 'Fancy thing' }))).toBe('button');
  });

  it('treats heading text as a heading', () => {
    expect(androidRole(rawNode({ className: 'android.widget.TextView', heading: true }))).toBe('heading');
  });

  it('handles a missing class name', () => {
    expect(androidRole(rawNode({ className: null }))).toBe('container');
  });
});

describe('accessibleName', () => {
  it('prefers the content description over visible text', () => {
    expect(accessibleName(rawNode({ contentDescription: 'Remove item', text: 'X' }))).toBe('Remove item');
  });

  it('uses the node’s own text, trimmed', () => {
    expect(accessibleName(rawNode({ text: '  Checkout  ' }))).toBe('Checkout');
  });

  it('ignores blank labels', () => {
    expect(accessibleName(rawNode({ contentDescription: '   ', text: '' }))).toBeNull();
  });

  it('names a text field by its hint, because its text is the value', () => {
    expect(accessibleName(rawNode({ editable: true, text: 'florent@example.com', hintText: 'Email' }))).toBe('Email');
    expect(accessibleName(rawNode({ editable: true, text: 'typed' }))).toBeNull();
  });

  it('lets a focusable container borrow its children’s text, like TalkBack', () => {
    const button = rawNode({
      clickable: true,
      children: [rawNode({ text: 'Checkout' }), rawNode({ children: [rawNode({ text: '€36.00' })] })],
    });
    expect(accessibleName(button)).toBe('Checkout, €36.00');
  });

  it('does not borrow text from a child that gets its own focus', () => {
    const row = rawNode({
      clickable: true,
      children: [rawNode({ text: 'Remove', clickable: true })],
    });
    expect(accessibleName(row)).toBeNull();
  });

  it('skips children that are off screen', () => {
    const button = rawNode({ focusable: true, children: [rawNode({ text: 'Hidden', visibleToUser: false })] });
    expect(accessibleName(button)).toBeNull();
  });

  it('reads through a wrapper hidden from accessibility to the text inside it', () => {
    const button = rawNode({
      clickable: true,
      children: [
        rawNode({ importantForAccessibility: false, text: 'ignored', children: [rawNode({ text: 'Apply code' })] }),
      ],
    });
    expect(accessibleName(button)).toBe('Apply code');
  });

  it('returns null for an icon-only button', () => {
    expect(accessibleName(rawNode({ clickable: true, children: [rawNode(), rawNode()] }))).toBeNull();
  });

  it('does not invent a name for a plain layout container', () => {
    expect(accessibleName(rawNode({ children: [rawNode({ text: 'Ceramic mug' })] }))).toBeNull();
  });
});

describe('normalizeAndroidCapture', () => {
  const tree = rawNode({
    bounds: [0, 0, 1080, 2400],
    children: [
      rawNode({
        className: 'android.widget.Button',
        resourceId: 'com.example.shop:id/remove',
        bounds: [100, 200, 196, 296],
        clickable: true,
      }),
      rawNode({
        className: 'android.widget.TextView',
        resourceId: 'seed-low-contrast',
        text: 'Free shipping',
        bounds: [100, 400, 500, 440],
        textSizePx: 28,
        children: [rawNode({ bounds: [0, 0, 0, 0] })],
      }),
    ],
  });
  const { screen, device } = normalizeAndroidCapture(captureOf(tree, 320), {
    screenId: 'screen-1',
    screenName: 'Cart',
    screenshotFile: 'screen-1.png',
  });

  it('assigns depth-first path ids with parent and child links', () => {
    expect(screen.nodes.map((node) => node.id)).toEqual(['0', '0.0', '0.1', '0.1.0']);
    expect(screen.nodes[0]?.childIds).toEqual(['0.0', '0.1']);
    expect(screen.nodes[3]?.parentId).toBe('0.1');
  });

  it('converts pixels to dp with the device density', () => {
    expect(screen.nodes[1]?.boundsDp).toEqual({ left: 50, top: 100, right: 98, bottom: 148 });
    expect(screen.nodes[2]?.textSizeDp).toBe(14);
  });

  it('shortens Android resource ids and keeps React Native testIDs', () => {
    expect(screen.nodes[1]?.resourceId).toBe('remove');
    expect(screen.nodes[2]?.resourceId).toBe('seed-low-contrast');
    expect(screen.nodes[0]?.resourceId).toBeNull();
  });

  it('derives role, name and interactivity', () => {
    expect(screen.nodes[1]).toMatchObject({ role: 'button', interactive: true, name: null });
    expect(screen.nodes[2]).toMatchObject({ role: 'text', interactive: false, name: 'Free shipping' });
  });

  it('treats zero-size nodes as invisible', () => {
    expect(screen.nodes[3]?.visible).toBe(false);
  });

  it('records the screen and device', () => {
    expect(screen).toMatchObject({ id: 'screen-1', name: 'Cart', appId: 'com.example.shop' });
    expect(screen.screenshot).toEqual({ file: 'screen-1.png', widthPx: 1080, heightPx: 2400 });
    expect(device).toMatchObject({ platform: 'android', apiLevel: 36, osVersion: '16', densityDpi: 320 });
  });

  it('marks nodes interactive from click actions and interactive roles', () => {
    const viaAction = normalizeAndroidCapture(captureOf(rawNode({ actions: [16] })), {
      screenId: 's',
      screenName: 's',
      screenshotFile: null,
    });
    const viaRole = normalizeAndroidCapture(captureOf(rawNode({ roleDescription: 'link' })), {
      screenId: 's',
      screenName: 's',
      screenshotFile: null,
    });
    expect(viaAction.screen.nodes[0]?.interactive).toBe(true);
    expect(viaRole.screen.nodes[0]?.interactive).toBe(true);
    expect(viaRole.screen.screenshot).toBeNull();
  });
});

describe('parseAndroidCapture', () => {
  const valid = () =>
    JSON.parse(JSON.stringify(captureOf(rawNode({ children: [rawNode()] })))) as Record<string, unknown>;

  it('accepts a well-formed capture', () => {
    const input = valid();
    expect(parseAndroidCapture(input)).toBe(input);
  });

  it('rejects another protocol version with advice', () => {
    expect(() => parseAndroidCapture({ ...valid(), protocol: 2 })).toThrow(/protocol 2.*protocol 1/);
  });

  it('rejects values that are not objects', () => {
    expect(() => parseAndroidCapture(null)).toThrow('capture must be an object.');
    expect(() => parseAndroidCapture([])).toThrow('capture must be an object.');
  });

  it('names the field that is wrong', () => {
    const input = valid();
    (input.device as Record<string, unknown>).densityDpi = '420';
    expect(() => parseAndroidCapture(input)).toThrow('capture.device.densityDpi must be a number.');

    const other = valid();
    other.windowTitle = 5;
    expect(() => parseAndroidCapture(other)).toThrow('capture.windowTitle must be a string or null.');
  });

  it('validates nested nodes with their path', () => {
    const input = valid();
    const root = input.root as { children: Record<string, unknown>[] };
    const child = root.children[0];
    if (child === undefined) throw new Error('fixture has a child');
    child.bounds = [0, 0, 10];
    expect(() => parseAndroidCapture(input)).toThrow('capture.root.children[0].bounds must be four numbers');

    child.bounds = [0, 0, 10, 10];
    child.actions = ['click'];
    expect(() => parseAndroidCapture(input)).toThrow('capture.root.children[0].actions must be an array of numbers.');

    child.actions = [];
    child.textSizePx = '14';
    expect(() => parseAndroidCapture(input)).toThrow('textSizePx must be a number or null.');

    child.textSizePx = null;
    child.children = null;
    expect(() => parseAndroidCapture(input)).toThrow('children must be an array.');

    child.children = [];
    child.clickable = 'yes';
    expect(() => parseAndroidCapture(input)).toThrow('capture.root.children[0].clickable must be a boolean.');
  });

  it('requires the top-level strings', () => {
    const input = valid();
    delete input.packageName;
    expect(() => parseAndroidCapture(input)).toThrow('capture.packageName must be a string.');
  });
});

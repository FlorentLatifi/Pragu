import { describe, expect, it } from 'vitest';
import { accessibleName, androidRole, normalizeAndroidCapture, parseAndroidCapture } from '../src/index.js';
import type { AndroidRawNode, AndroidRawWindow } from '../src/index.js';
import { captureOf, rawNode, windowOf } from './helpers.js';

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

  it('names a field by the element that labels it (labelFor, aria-labelledby)', () => {
    expect(accessibleName(rawNode({ editable: true, labeledBy: 'Gift card number' }))).toBe('Gift card number');
    expect(accessibleName(rawNode({ editable: true, labeledBy: '  ' }))).toBeNull();
  });

  it('names a Compose text field by the label text inside it', () => {
    const field = (children: AndroidRawNode[]) =>
      rawNode({ className: 'android.widget.EditText', editable: true, focusable: true, text: '', children });
    expect(accessibleName(field([rawNode({ importantForAccessibility: false }), rawNode({ text: 'Full name' })]))).toBe(
      'Full name',
    );
    expect(accessibleName(field([rawNode({ importantForAccessibility: false })]))).toBeNull();
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

  it('records whether a screen reader gives a node its own focus stop', () => {
    const focusable = (raw: AndroidRawNode) =>
      normalizeAndroidCapture(captureOf(raw), { screenId: 's', screenName: 's', screenshotFile: null }).screen.nodes[0]
        ?.focusable;
    expect(focusable(rawNode({ focusable: true }))).toBe(true);
    expect(focusable(rawNode({ screenReaderFocusable: true }))).toBe(true);
    expect(focusable(rawNode({ className: 'android.widget.ImageView' }))).toBe(false);
  });

  it('exposes a checked state only for checkable nodes, and keeps the state text', () => {
    const normalize = (raw: AndroidRawNode) =>
      normalizeAndroidCapture(captureOf(raw), { screenId: 's', screenName: 's', screenshotFile: null }).screen.nodes[0];
    expect(normalize(rawNode({ checkable: true, checked: true }))).toMatchObject({ checked: true });
    expect(normalize(rawNode({ checkable: true }))).toMatchObject({ checked: false });
    expect(normalize(rawNode({ checked: true }))).toMatchObject({ checked: null, stateDescription: null });
    expect(normalize(rawNode({ stateDescription: ' On ' }))?.stateDescription).toBe('On');
  });

  it('treats zero-size nodes as invisible', () => {
    expect(screen.nodes[3]?.visible).toBe(false);
  });

  it('records the screen and device', () => {
    expect(screen).toMatchObject({ id: 'screen-1', name: 'Cart', appId: 'com.example.shop' });
    expect(screen.screenshot).toEqual({ file: 'screen-1.png', widthPx: 1080, heightPx: 2400 });
    expect(device).toMatchObject({ platform: 'android', apiLevel: 36, osVersion: '16', densityDpi: 320 });
  });

  it('marks nodes interactive from click actions, and from control roles where TalkBack stops', () => {
    const normalize = (raw: AndroidRawNode) =>
      normalizeAndroidCapture(captureOf(raw), { screenId: 's', screenName: 's', screenshotFile: null });
    const viaAction = normalize(rawNode({ actions: [16] }));
    const viaRole = normalize(rawNode({ roleDescription: 'link', focusable: true }));
    const roleOnly = normalize(rawNode({ roleDescription: 'link' }));
    expect(viaAction.screen.nodes[0]?.interactive).toBe(true);
    expect(viaRole.screen.nodes[0]?.interactive).toBe(true);
    expect(roleOnly.screen.nodes[0]?.interactive).toBe(false);
    expect(viaRole.screen.screenshot).toBeNull();
  });
});

// Shapes recorded from Compose 1.12 on Android 16 (fixtures/android-compose).
describe('Compose', () => {
  const normalize = (content: AndroidRawNode) => {
    const host = rawNode({
      className: 'androidx.compose.ui.platform.ComposeView',
      bounds: [0, 0, 1080, 2400],
      children: [content],
    });
    return normalizeAndroidCapture(captureOf(host), { screenId: 's', screenName: 'S', screenshotFile: null }).screen;
  };

  it('reads a Material IconButton as one button: its role child is not a control of its own', () => {
    const iconButton = rawNode({
      className: 'android.view.View',
      resourceId: 'back',
      clickable: true,
      focusable: true,
      actions: [16],
      bounds: [0, 0, 96, 96],
      children: [
        rawNode({ className: 'android.view.View', contentDescription: 'Back', bounds: [24, 24, 72, 72] }),
        rawNode({ className: 'android.widget.Button', bounds: [8, 8, 88, 88] }),
      ],
    });
    const screen = normalize(iconButton);
    expect(screen.nodes[1]).toMatchObject({ resourceId: 'back', role: 'button', name: 'Back', interactive: true });
    expect(screen.nodes[3]).toMatchObject({ role: 'button', interactive: false });
  });

  it('takes a switch’s role from the child Compose puts it on', () => {
    const unlabelledSwitch = rawNode({
      className: 'android.view.View',
      clickable: true,
      focusable: true,
      checkable: true,
      stateDescription: 'Off',
      children: [
        rawNode({ className: 'android.view.View', importantForAccessibility: false }),
        rawNode({ className: 'android.view.View', roleDescription: 'Switch' }),
      ],
    });
    expect(normalize(unlabelledSwitch).nodes[1]).toMatchObject({ role: 'switch', name: null, interactive: true });
  });

  it('sees a checkbox role but no state on clickable(role = Role.Checkbox)', () => {
    const giftWrap = rawNode({
      className: 'android.view.View',
      clickable: true,
      focusable: true,
      children: [
        rawNode({ className: 'android.widget.CheckBox' }),
        rawNode({ className: 'android.widget.TextView', text: 'Gift wrap this order' }),
      ],
    });
    expect(normalize(giftWrap).nodes[1]).toMatchObject({
      role: 'checkbox',
      name: 'Gift wrap this order',
      checked: null,
      stateDescription: null,
    });
  });

  it('marks the bounds of Compose controls as touch areas, and nothing else', () => {
    const screen = normalize(
      rawNode({
        className: 'android.view.View',
        children: [
          rawNode({ className: 'android.view.View', clickable: true, contentDescription: 'Clear cache' }),
          rawNode({ className: 'android.widget.TextView', text: 'Cache' }),
        ],
      }),
    );
    expect(screen.nodes.map((node) => node.boundsAreTouchArea)).toEqual([false, false, true, false]);
    const views = normalizeAndroidCapture(captureOf(rawNode({ clickable: true })), {
      screenId: 's',
      screenName: 'S',
      screenshotFile: null,
    });
    expect(views.screen.nodes[0]?.boundsAreTouchArea).toBe(false);
  });
});

describe('windows', () => {
  const normalize = (root: AndroidRawNode, windows: AndroidRawWindow[]) =>
    normalizeAndroidCapture(captureOf(root, 160, windows), { screenId: 's', screenName: 'S', screenshotFile: null })
      .screen;
  const find = (screen: ReturnType<typeof normalize>, resourceId: string) =>
    screen.nodes.find((node) => node.resourceId === resourceId);

  it('checks only the app’s topmost window: a dialog hides what is behind it', () => {
    const app = rawNode({
      bounds: [0, 0, 1080, 2400],
      children: [rawNode({ resourceId: 'behind', clickable: true, bounds: [100, 100, 200, 200] })],
    });
    const dialog = rawNode({
      bounds: [100, 800, 980, 1600],
      children: [rawNode({ resourceId: 'dialog-ok', clickable: true, bounds: [200, 1400, 400, 1500] })],
    });
    const screen = normalize(app, [
      windowOf(app),
      windowOf(dialog, { layer: 1, bounds: [100, 800, 980, 1600], title: 'Remove?' }),
    ]);
    expect(find(screen, 'behind')).toMatchObject({ visible: false, window: 0, id: '0.0' });
    expect(find(screen, 'dialog-ok')).toMatchObject({ visible: true, window: 1, id: '1.0' });
    expect(screen.windows.map((window) => [window.kind, window.foreground, window.title])).toEqual([
      ['app', false, 'Shop'],
      ['app', true, 'Remove?'],
    ]);
  });

  it('hides elements under the keyboard and marks partly covered ones as obscured', () => {
    const form = rawNode({
      bounds: [0, 0, 1080, 2400],
      children: [
        rawNode({ resourceId: 'under', bounds: [0, 2000, 500, 2100] }),
        rawNode({ resourceId: 'edge', bounds: [0, 1450, 500, 1550] }),
        rawNode({ resourceId: 'clear', bounds: [0, 100, 500, 200] }),
      ],
    });
    const keyboard = windowOf(null, { type: 'input_method', layer: 2, bounds: [0, 1500, 1080, 2400], active: false });
    // Windows arrive in any order; stacking follows the layer.
    const screen = normalize(form, [keyboard, windowOf(form)]);
    expect(find(screen, 'under')).toMatchObject({ visible: false, obscured: false });
    expect(find(screen, 'edge')).toMatchObject({ visible: true, obscured: true });
    expect(find(screen, 'clear')).toMatchObject({ visible: true, obscured: false });
    expect(screen.windows.map((window) => window.kind)).toEqual(['app', 'keyboard']);
  });

  it('lets assistive overlays through, but not system UI or other apps', () => {
    const page = rawNode({
      bounds: [0, 0, 1080, 2400],
      children: [rawNode({ resourceId: 'x', bounds: [10, 10, 50, 50] })],
    });
    const full: [number, number, number, number] = [0, 0, 1080, 2400];
    const over = (type: AndroidRawWindow['type']) =>
      normalize(page, [windowOf(page), windowOf(null, { type, layer: 1, bounds: full })]);
    expect(find(over('accessibility_overlay'), 'x')?.visible).toBe(true);
    expect(find(over('magnification_overlay'), 'x')?.visible).toBe(true);
    expect(find(over('application'), 'x')?.visible).toBe(false);
    expect(find(over('system'), 'x')?.visible).toBe(false);
    expect(
      (
        [
          'application',
          'input_method',
          'system',
          'accessibility_overlay',
          'split_screen_divider',
          'magnification_overlay',
          'unknown',
        ] as const
      ).map((type) => over(type).windows[1]?.kind),
    ).toEqual(['other-app', 'keyboard', 'system', 'overlay', 'system', 'overlay', 'system']);
  });

  it('marks web content, so rules leave it to web tools', () => {
    const page = rawNode({
      bounds: [0, 0, 1080, 2400],
      children: [
        rawNode({
          className: 'android.webkit.WebView',
          bounds: [0, 0, 1080, 1200],
          children: [rawNode({ className: 'android.widget.Button', clickable: true, bounds: [10, 10, 50, 50] })],
        }),
        rawNode({ resourceId: 'native', bounds: [0, 1300, 100, 1400] }),
      ],
    });
    const screen = normalize(page, [windowOf(page)]);
    expect(screen.nodes.map((node) => node.inWebView)).toEqual([false, true, true, false]);
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
    expect(() => parseAndroidCapture({ ...valid(), protocol: 3 })).toThrow(/protocol 3.*protocol 4/);
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
    const windows = input.windows as { root: { children: Record<string, unknown>[] } }[];
    const child = windows[0]?.root.children[0];
    if (child === undefined) throw new Error('fixture has a child');
    child.bounds = [0, 0, 10];
    expect(() => parseAndroidCapture(input)).toThrow('capture.windows[0].root.children[0].bounds must be four numbers');

    child.bounds = [0, 0, 10, 10];
    child.actions = ['click'];
    expect(() => parseAndroidCapture(input)).toThrow(
      'capture.windows[0].root.children[0].actions must be an array of numbers.',
    );

    child.actions = [];
    child.textSizePx = '14';
    expect(() => parseAndroidCapture(input)).toThrow('textSizePx must be a number or null.');

    child.textSizePx = null;
    child.children = null;
    expect(() => parseAndroidCapture(input)).toThrow('children must be an array.');

    child.children = [];
    child.clickable = 'yes';
    expect(() => parseAndroidCapture(input)).toThrow(
      'capture.windows[0].root.children[0].clickable must be a boolean.',
    );
  });

  it('validates the windows', () => {
    const missing = valid();
    missing.windows = [];
    expect(() => parseAndroidCapture(missing)).toThrow('capture.windows must be a non-empty array.');

    const badType = valid();
    (badType.windows as Record<string, unknown>[])[0] = { ...windowOf(null), type: 'popup' };
    expect(() => parseAndroidCapture(badType)).toThrow('capture.windows[0].type must be one of application,');

    const badBounds = valid();
    (badBounds.windows as Record<string, unknown>[]).push({ ...windowOf(null), bounds: [0, 0] });
    expect(() => parseAndroidCapture(badBounds)).toThrow('capture.windows[1].bounds must be four numbers');

    const badFlag = valid();
    (badFlag.windows as Record<string, unknown>[]).push({ ...windowOf(null), focused: 'yes' });
    expect(() => parseAndroidCapture(badFlag)).toThrow('capture.windows[1].focused must be a boolean.');

    const noApp = valid();
    noApp.windows = [windowOf(null, { type: 'system' })];
    expect(() => parseAndroidCapture(noApp)).toThrow('no window of the scanned app');
  });

  it('requires the top-level strings', () => {
    const input = valid();
    delete input.packageName;
    expect(() => parseAndroidCapture(input)).toThrow('capture.packageName must be a string.');
  });
});

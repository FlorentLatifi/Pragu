// Translates a capture from the Pragu Android agent into the platform-neutral
// model. Everything Android-specific (class names, TalkBack's naming rules,
// density) stays in this file.

import { containsRect, rectsOverlap, scaleRect } from './geometry.js';
import type { DeviceInfo, PamNode, PamScreen, PamWindow, Rect, Role } from './model.js';

/** The agent protocol version this adapter understands. 2 added windows; 3 added labeledBy. */
export const ANDROID_AGENT_PROTOCOL = 3;

/** AccessibilityWindowInfo types, as the agent names them. */
export type AndroidWindowType =
  | 'application'
  | 'input_method'
  | 'system'
  | 'accessibility_overlay'
  | 'split_screen_divider'
  | 'magnification_overlay'
  | 'unknown';

const WINDOW_TYPES: readonly AndroidWindowType[] = [
  'application',
  'input_method',
  'system',
  'accessibility_overlay',
  'split_screen_divider',
  'magnification_overlay',
  'unknown',
];

/** One node as the agent reports it, close to AccessibilityNodeInfo. */
export interface AndroidRawNode {
  className: string | null;
  packageName: string | null;
  resourceId: string | null;
  text: string | null;
  contentDescription: string | null;
  hintText: string | null;
  /** Words of the element that labels this one (android:labelFor, React Native aria-labelledby). */
  labeledBy: string | null;
  stateDescription: string | null;
  roleDescription: string | null;
  /** left, top, right, bottom in screen pixels. */
  bounds: [number, number, number, number];
  clickable: boolean;
  longClickable: boolean;
  focusable: boolean;
  checkable: boolean;
  checked: boolean;
  enabled: boolean;
  editable: boolean;
  visibleToUser: boolean;
  importantForAccessibility: boolean;
  heading: boolean;
  screenReaderFocusable: boolean;
  /** AccessibilityAction ids, e.g. 16 for ACTION_CLICK. */
  actions: number[];
  textSizePx: number | null;
  children: AndroidRawNode[];
}

export interface AndroidRawDevice {
  manufacturer: string;
  model: string;
  sdkInt: number;
  release: string;
  densityDpi: number;
  fontScale: number;
  locale: string;
  nightMode: boolean;
}

/** One window on screen. Only the scanned app's windows carry a tree. */
export interface AndroidRawWindow {
  type: AndroidWindowType;
  /** Stacking order: higher layers are drawn on top. */
  layer: number;
  title: string | null;
  bounds: [number, number, number, number];
  active: boolean;
  focused: boolean;
  root: AndroidRawNode | null;
}

export interface AndroidCapture {
  protocol: number;
  agentVersion: string;
  capturedAt: string;
  packageName: string;
  windowTitle: string | null;
  screenWidthPx: number;
  screenHeightPx: number;
  device: AndroidRawDevice;
  /** Every window on screen, bottom first. */
  windows: AndroidRawWindow[];
}

const ACTION_CLICK = 16;
const ACTION_LONG_CLICK = 32;

// Most specific first: "ImageButton" must win over "Button".
const CLASS_ROLES: readonly (readonly [string, Role])[] = [
  ['ImageButton', 'button'],
  ['CheckBox', 'checkbox'],
  ['RadioButton', 'radio'],
  ['Switch', 'switch'],
  ['ToggleButton', 'switch'],
  ['Button', 'button'],
  ['EditText', 'textfield'],
  ['SeekBar', 'slider'],
  ['ProgressBar', 'progressbar'],
  ['ImageView', 'image'],
  ['TextView', 'text'],
  ['RecyclerView', 'list'],
  ['ListView', 'list'],
  ['GridView', 'list'],
];

// React Native and Compose describe some roles in text rather than class names.
const ROLE_DESCRIPTIONS: Readonly<Record<string, Role>> = {
  button: 'button',
  link: 'link',
  tab: 'tab',
  heading: 'heading',
  header: 'heading',
  image: 'image',
  switch: 'switch',
  checkbox: 'checkbox',
  'check box': 'checkbox',
  'radio button': 'radio',
  slider: 'slider',
};

const INTERACTIVE_ROLES: ReadonlySet<Role> = new Set([
  'button',
  'link',
  'switch',
  'checkbox',
  'radio',
  'tab',
  'slider',
  'textfield',
]);

export function androidRole(raw: AndroidRawNode): Role {
  const described = raw.roleDescription?.trim().toLowerCase();
  if (described !== undefined) {
    const role = ROLE_DESCRIPTIONS[described];
    if (role !== undefined) return role;
  }
  if (raw.heading) return 'heading';
  const className = raw.className ?? '';
  const simpleName = className.slice(className.lastIndexOf('.') + 1);
  for (const [fragment, role] of CLASS_ROLES) {
    if (simpleName.includes(fragment)) return role;
  }
  return 'container';
}

/** Whether TalkBack gives this node its own focus stop (and so stops borrowing its children's text). */
function isActionable(raw: AndroidRawNode): boolean {
  return raw.clickable || raw.longClickable || raw.focusable || raw.screenReaderFocusable || raw.checkable;
}

function isInteractive(raw: AndroidRawNode, role: Role): boolean {
  return (
    raw.clickable ||
    raw.longClickable ||
    raw.checkable ||
    raw.editable ||
    raw.actions.includes(ACTION_CLICK) ||
    raw.actions.includes(ACTION_LONG_CLICK) ||
    // A control role alone counts only where TalkBack stops. Compose puts a Button's or
    // Switch's role on a child that TalkBack reads as part of the clickable parent.
    (INTERACTIVE_ROLES.has(role) && isActionable(raw))
  );
}

/**
 * TalkBack reads a focus stop together with the children that have no focus stop of
 * their own, roles included. Compose relies on this: Button, Checkbox and Switch put
 * their role on a child under the clickable node. A clickable container therefore
 * takes the first control role it reads out.
 */
function announcedRole(raw: AndroidRawNode): Role {
  const role = androidRole(raw);
  if (role !== 'container' || !isActionable(raw)) return role;
  return readOutControlRole(raw) ?? role;
}

function readOutControlRole(raw: AndroidRawNode): Role | null {
  for (const child of raw.children) {
    if (!child.visibleToUser || (child.importantForAccessibility && isActionable(child))) continue;
    const role = androidRole(child);
    if (child.importantForAccessibility && INTERACTIVE_ROLES.has(role)) return role;
    const nested = readOutControlRole(child);
    if (nested !== null) return nested;
  }
  return null;
}

/**
 * Approximates the label TalkBack speaks for a node: its content description, the
 * element that labels it, then its own text, then (for a focusable container) the
 * text of descendants that do not get a focus stop of their own. A text field's
 * text is its value, not its label, so it is named by its hint or, in Compose, by
 * the label text inside it.
 */
export function accessibleName(raw: AndroidRawNode): string | null {
  const description = nonBlank(raw.contentDescription) ?? nonBlank(raw.labeledBy);
  if (description !== null) return description;
  if (raw.editable) return nonBlank(raw.hintText) ?? descendantLabel(raw);
  const text = nonBlank(raw.text);
  if (text !== null) return text;
  if (!isActionable(raw)) return null;
  return descendantLabel(raw);
}

function descendantLabel(raw: AndroidRawNode): string | null {
  const parts: string[] = [];
  collectDescendantLabels(raw, parts);
  return parts.length > 0 ? parts.join(', ') : null;
}

function collectDescendantLabels(raw: AndroidRawNode, parts: string[]): void {
  for (const child of raw.children) {
    if (!child.visibleToUser) continue;
    if (child.importantForAccessibility && isActionable(child)) continue;
    // A view hidden from accessibility contributes nothing itself, but its children can still be read.
    const label = child.importantForAccessibility ? (nonBlank(child.contentDescription) ?? nonBlank(child.text)) : null;
    if (label !== null) parts.push(label);
    else collectDescendantLabels(child, parts);
  }
}

function nonBlank(value: string | null): string | null {
  return value !== null && value.trim() !== '' ? value.trim() : null;
}

export interface NormalizedCapture {
  screen: PamScreen;
  device: DeviceInfo;
}

function windowKind(window: AndroidRawWindow): PamWindow['kind'] {
  switch (window.type) {
    case 'application':
      return window.root === null ? 'other-app' : 'app';
    case 'input_method':
      return 'keyboard';
    case 'accessibility_overlay':
    case 'magnification_overlay':
      return 'overlay';
    default:
      return 'system';
  }
}

function rectFrom([left, top, right, bottom]: [number, number, number, number]): Rect {
  return { left, top, right, bottom };
}

/** Web content is the job of web tools such as axe-core; Pragu checks native UI only. */
function isWebView(raw: AndroidRawNode): boolean {
  const className = raw.className ?? '';
  return className.slice(className.lastIndexOf('.') + 1).includes('WebView');
}

/** Everything under a ComposeView is a Compose semantics node rather than a View. */
function isComposeHost(raw: AndroidRawNode): boolean {
  return (raw.className ?? '').endsWith('ComposeView');
}

interface VisitContext {
  windowIndex: number;
  inForeground: boolean;
  inWebView: boolean;
  inCompose: boolean;
}

/**
 * Builds the PAM screen from every window. Only the app's topmost window is
 * checked: a dialog over the app means the content behind it is not what the user
 * can act on. Within it, elements fully covered by a window above (the keyboard, a
 * system panel) are invisible, and partly covered ones are marked obscured, because
 * their pixels in the screenshot are not all their own.
 */
export function normalizeAndroidCapture(
  capture: AndroidCapture,
  options: { screenId: string; screenName: string; screenshotFile: string | null },
): NormalizedCapture {
  const density = capture.device.densityDpi / 160;
  const rawWindows = [...capture.windows].sort((a, b) => a.layer - b.layer);
  const foregroundIndex = rawWindows.findLastIndex((window) => window.root !== null);
  const windows: PamWindow[] = rawWindows.map((window, index) => ({
    kind: windowKind(window),
    title: window.title,
    boundsPx: rectFrom(window.bounds),
    foreground: index === foregroundIndex,
  }));
  // Overlays drawn by assistive technology are see-through; every other window above hides what is under it.
  const coverers = windows
    .slice(foregroundIndex + 1)
    .filter((window) => window.kind !== 'overlay')
    .map((window) => window.boundsPx);
  const nodes: PamNode[] = [];

  const visit = (raw: AndroidRawNode, id: string, parentId: string | null, context: VisitContext): void => {
    const role = announcedRole(raw);
    const interactive = isInteractive(raw, role);
    const boundsPx = rectFrom(raw.bounds);
    const onScreen = raw.visibleToUser && boundsPx.right > boundsPx.left && boundsPx.bottom > boundsPx.top;
    const covered = !context.inForeground || coverers.some((cover) => containsRect(cover, boundsPx));
    const inWebView = context.inWebView || isWebView(raw);
    const node: PamNode = {
      id,
      parentId,
      childIds: [],
      role,
      platformRole: raw.className ?? 'unknown',
      name: accessibleName(raw),
      text: nonBlank(raw.text),
      hint: nonBlank(raw.hintText),
      resourceId: shortResourceId(raw.resourceId),
      boundsPx,
      boundsDp: roundRect(scaleRect(boundsPx, 1 / density)),
      // Compose reports a clickable's touch area (enlarged to 48 dp) as its bounds.
      boundsAreTouchArea: context.inCompose && interactive,
      interactive,
      exposedToAssistiveTech: raw.importantForAccessibility,
      visible: onScreen && !covered,
      obscured: !covered && coverers.some((cover) => rectsOverlap(cover, boundsPx)),
      inWebView,
      window: context.windowIndex,
      enabled: raw.enabled,
      textSizeDp: raw.textSizePx === null ? null : round1(raw.textSizePx / density),
    };
    nodes.push(node);
    raw.children.forEach((child, index) => {
      const childId = `${id}.${String(index)}`;
      node.childIds.push(childId);
      visit(child, childId, id, { ...context, inWebView, inCompose: context.inCompose || isComposeHost(raw) });
    });
  };

  // Each app window's root is "0", "1", ... bottom first, so a single-window screen keeps the ids "0", "0.1", ...
  let appWindowNumber = 0;
  rawWindows.forEach((window, windowIndex) => {
    if (window.root === null) return;
    visit(window.root, String(appWindowNumber++), null, {
      windowIndex,
      inForeground: windowIndex === foregroundIndex,
      inWebView: false,
      inCompose: false,
    });
  });

  const screen: PamScreen = {
    id: options.screenId,
    name: options.screenName,
    appId: capture.packageName,
    screenshot:
      options.screenshotFile === null
        ? null
        : { file: options.screenshotFile, widthPx: capture.screenWidthPx, heightPx: capture.screenHeightPx },
    windows,
    nodes,
  };
  const device: DeviceInfo = {
    platform: 'android',
    osVersion: capture.device.release,
    apiLevel: capture.device.sdkInt,
    manufacturer: capture.device.manufacturer,
    model: capture.device.model,
    densityDpi: capture.device.densityDpi,
    fontScale: capture.device.fontScale,
    locale: capture.device.locale,
    nightMode: capture.device.nightMode,
    screenWidthPx: capture.screenWidthPx,
    screenHeightPx: capture.screenHeightPx,
  };
  return { screen, device };
}

/** "com.example:id/save" becomes "save"; React Native testIDs arrive without a package and stay as they are. */
function shortResourceId(resourceId: string | null): string | null {
  if (resourceId === null || resourceId === '') return null;
  const slash = resourceId.indexOf(':id/');
  return slash === -1 ? resourceId : resourceId.slice(slash + 4);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundRect(rect: Rect): Rect {
  return { left: round1(rect.left), top: round1(rect.top), right: round1(rect.right), bottom: round1(rect.bottom) };
}

/**
 * Validates untrusted agent output before anything else touches it. Errors name
 * the offending field so a protocol mismatch is easy to diagnose.
 */
export function parseAndroidCapture(value: unknown): AndroidCapture {
  const capture = asRecord(value, 'capture');
  if (capture.protocol !== ANDROID_AGENT_PROTOCOL) {
    throw new Error(
      `The Android agent speaks protocol ${String(capture.protocol)}, but this Pragu understands protocol ${String(ANDROID_AGENT_PROTOCOL)}. ` +
        'Reinstall the agent that ships with this Pragu version.',
    );
  }
  expectString(capture, 'agentVersion', 'capture');
  expectString(capture, 'capturedAt', 'capture');
  expectString(capture, 'packageName', 'capture');
  expectNullableString(capture, 'windowTitle', 'capture');
  expectNumber(capture, 'screenWidthPx', 'capture');
  expectNumber(capture, 'screenHeightPx', 'capture');
  const device = asRecord(capture.device, 'capture.device');
  for (const key of ['manufacturer', 'model', 'release', 'locale']) expectString(device, key, 'capture.device');
  for (const key of ['sdkInt', 'densityDpi', 'fontScale']) expectNumber(device, key, 'capture.device');
  expectBoolean(device, 'nightMode', 'capture.device');
  if (!Array.isArray(capture.windows) || capture.windows.length === 0) {
    throw new Error('capture.windows must be a non-empty array.');
  }
  let appWindows = 0;
  capture.windows.forEach((item, index) => {
    const path = `capture.windows[${String(index)}]`;
    const window = asRecord(item, path);
    if (typeof window.type !== 'string' || !(WINDOW_TYPES as readonly string[]).includes(window.type)) {
      throw new Error(`${path}.type must be one of ${WINDOW_TYPES.join(', ')}.`);
    }
    expectNumber(window, 'layer', path);
    expectNullableString(window, 'title', path);
    expectBounds(window.bounds, path);
    expectBoolean(window, 'active', path);
    expectBoolean(window, 'focused', path);
    if (window.root !== null) {
      validateNode(window.root, `${path}.root`);
      appWindows++;
    }
  });
  if (appWindows === 0) {
    throw new Error('The capture has no window of the scanned app: no window carries an element tree.');
  }
  return value as AndroidCapture;
}

const NODE_STRINGS = [
  'className',
  'packageName',
  'resourceId',
  'text',
  'contentDescription',
  'hintText',
  'labeledBy',
  'stateDescription',
  'roleDescription',
];
const NODE_BOOLEANS = [
  'clickable',
  'longClickable',
  'focusable',
  'checkable',
  'checked',
  'enabled',
  'editable',
  'visibleToUser',
  'importantForAccessibility',
  'heading',
  'screenReaderFocusable',
];

function validateNode(value: unknown, path: string): void {
  const node = asRecord(value, path);
  for (const key of NODE_STRINGS) expectNullableString(node, key, path);
  for (const key of NODE_BOOLEANS) expectBoolean(node, key, path);
  expectBounds(node.bounds, path);
  if (!Array.isArray(node.actions) || !node.actions.every((n) => typeof n === 'number')) {
    throw new Error(`${path}.actions must be an array of numbers.`);
  }
  if (node.textSizePx !== null && typeof node.textSizePx !== 'number') {
    throw new Error(`${path}.textSizePx must be a number or null.`);
  }
  if (!Array.isArray(node.children)) throw new Error(`${path}.children must be an array.`);
  node.children.forEach((child, index) => {
    validateNode(child, `${path}.children[${String(index)}]`);
  });
}

function expectBounds(bounds: unknown, path: string): void {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every((n) => typeof n === 'number')) {
    throw new Error(`${path}.bounds must be four numbers [left, top, right, bottom].`);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function expectString(record: Record<string, unknown>, key: string, path: string): void {
  if (typeof record[key] !== 'string') throw new Error(`${path}.${key} must be a string.`);
}

function expectNullableString(record: Record<string, unknown>, key: string, path: string): void {
  const value = record[key];
  if (value !== null && typeof value !== 'string') throw new Error(`${path}.${key} must be a string or null.`);
}

function expectNumber(record: Record<string, unknown>, key: string, path: string): void {
  if (typeof record[key] !== 'number') throw new Error(`${path}.${key} must be a number.`);
}

function expectBoolean(record: Record<string, unknown>, key: string, path: string): void {
  if (typeof record[key] !== 'boolean') throw new Error(`${path}.${key} must be a boolean.`);
}

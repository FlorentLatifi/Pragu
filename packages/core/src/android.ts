// Translates a capture from the Pragu Android agent into the platform-neutral
// model. Everything Android-specific (class names, TalkBack's naming rules,
// density) stays in this file.

import { scaleRect } from './geometry.js';
import type { DeviceInfo, PamNode, PamScreen, Rect, Role } from './model.js';

/** The agent protocol version this adapter understands. */
export const ANDROID_AGENT_PROTOCOL = 1;

/** One node as the agent reports it, close to AccessibilityNodeInfo. */
export interface AndroidRawNode {
  className: string | null;
  packageName: string | null;
  resourceId: string | null;
  text: string | null;
  contentDescription: string | null;
  hintText: string | null;
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

export interface AndroidCapture {
  protocol: number;
  agentVersion: string;
  capturedAt: string;
  packageName: string;
  windowTitle: string | null;
  screenWidthPx: number;
  screenHeightPx: number;
  device: AndroidRawDevice;
  root: AndroidRawNode;
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
    INTERACTIVE_ROLES.has(role)
  );
}

/**
 * Approximates the label TalkBack speaks for a node: its content description,
 * then its own text, then (for a focusable container) the text of descendants
 * that do not get a focus stop of their own. Text fields use their hint because
 * their text is the value, not the label.
 */
export function accessibleName(raw: AndroidRawNode): string | null {
  const description = nonBlank(raw.contentDescription);
  if (description !== null) return description;
  if (raw.editable) return nonBlank(raw.hintText);
  const text = nonBlank(raw.text);
  if (text !== null) return text;
  if (!isActionable(raw)) return null;
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

export function normalizeAndroidCapture(
  capture: AndroidCapture,
  options: { screenId: string; screenName: string; screenshotFile: string | null },
): NormalizedCapture {
  const density = capture.device.densityDpi / 160;
  const nodes: PamNode[] = [];

  const visit = (raw: AndroidRawNode, id: string, parentId: string | null): void => {
    const role = androidRole(raw);
    const [left, top, right, bottom] = raw.bounds;
    const boundsPx: Rect = { left, top, right, bottom };
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
      interactive: isInteractive(raw, role),
      exposedToAssistiveTech: raw.importantForAccessibility,
      visible: raw.visibleToUser && right > left && bottom > top,
      enabled: raw.enabled,
      textSizeDp: raw.textSizePx === null ? null : round1(raw.textSizePx / density),
    };
    nodes.push(node);
    raw.children.forEach((child, index) => {
      const childId = `${id}.${String(index)}`;
      node.childIds.push(childId);
      visit(child, childId, id);
    });
  };
  visit(capture.root, '0', null);

  const screen: PamScreen = {
    id: options.screenId,
    name: options.screenName,
    appId: capture.packageName,
    screenshot:
      options.screenshotFile === null
        ? null
        : { file: options.screenshotFile, widthPx: capture.screenWidthPx, heightPx: capture.screenHeightPx },
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
  validateNode(capture.root, 'capture.root');
  return value as AndroidCapture;
}

const NODE_STRINGS = [
  'className',
  'packageName',
  'resourceId',
  'text',
  'contentDescription',
  'hintText',
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
  const bounds = node.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every((n) => typeof n === 'number')) {
    throw new Error(`${path}.bounds must be four numbers [left, top, right, bottom].`);
  }
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

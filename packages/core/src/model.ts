// The Pragu Accessibility Model (PAM): a platform-neutral description of what a
// screen exposes to assistive technology. Platform adapters (android.ts today,
// iOS later) translate native captures into it; rules only ever see PAM.

/** Version of the JSON result contract written to pragu-result.json. 0.2.0 added windows. */
export const RESULT_SCHEMA_VERSION = '0.2.0';

export type Platform = 'android' | 'ios';
export type Severity = 'error' | 'warning' | 'info';
export type Confidence = 'high' | 'medium' | 'low';

/** Normalised roles. The platform's own class stays in `PamNode.platformRole`. */
export type Role =
  | 'button'
  | 'link'
  | 'image'
  | 'text'
  | 'heading'
  | 'textfield'
  | 'switch'
  | 'checkbox'
  | 'radio'
  | 'tab'
  | 'slider'
  | 'progressbar'
  | 'list'
  | 'container';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PamNode {
  /** Position in the tree, e.g. "0.3.1". Unique within one screen capture. */
  id: string;
  parentId: string | null;
  childIds: string[];
  role: Role;
  /** Platform class, e.g. android.widget.Button. */
  platformRole: string;
  /** The name a screen reader would announce. An approximation of TalkBack/VoiceOver. */
  name: string | null;
  text: string | null;
  hint: string | null;
  /** Developer-assigned id: Android resource id or React Native testID. */
  resourceId: string | null;
  boundsPx: Rect;
  boundsDp: Rect;
  /** Responds to activation: tap, long press, toggle or text entry. */
  interactive: boolean;
  /** False when the app hides the element from assistive technology. */
  exposedToAssistiveTech: boolean;
  /** On screen, in the app's topmost window, and not covered by another window. */
  visible: boolean;
  /** Partly covered by another window (keyboard, system bar), so its pixels are not all its own. */
  obscured: boolean;
  /** Inside a WebView: web content, which Pragu leaves to web tools such as axe-core. */
  inWebView: boolean;
  /** Index into PamScreen.windows of the window this element belongs to. */
  window: number;
  enabled: boolean;
  /** Rendered text size, when the platform reports it. */
  textSizeDp: number | null;
}

export interface Screenshot {
  file: string;
  widthPx: number;
  heightPx: number;
}

/**
 * A window on screen. Only the scanned app's windows have elements; the others
 * (keyboard, system bars, other apps) matter because they cover what is below them.
 */
export interface PamWindow {
  kind: 'app' | 'keyboard' | 'system' | 'other-app' | 'overlay';
  title: string | null;
  boundsPx: Rect;
  /** The scanned app's topmost window, e.g. an open dialog. The only one whose elements are checked. */
  foreground: boolean;
}

export interface PamScreen {
  id: string;
  name: string;
  appId: string;
  screenshot: Screenshot | null;
  /** Bottom first. */
  windows: PamWindow[];
  /** Depth-first per app window, bottom window first. */
  nodes: PamNode[];
}

export interface DeviceInfo {
  platform: Platform;
  osVersion: string;
  apiLevel: number;
  manufacturer: string;
  model: string;
  densityDpi: number;
  fontScale: number;
  locale: string;
  nightMode: boolean;
  screenWidthPx: number;
  screenHeightPx: number;
}

export interface FixGuidance {
  reactNative: string;
  compose: string;
  androidViews: string;
}

export interface Issue {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  screenId: string;
  nodeId: string;
  resourceId: string | null;
  /** Stable id that lets a baseline recognise the same issue in a later scan. */
  fingerprint: string;
  message: string;
  whoIsAffected: string;
  whatTheyExperience: string;
  wcag: string[];
  en301549: string[];
  boundsPx: Rect;
  evidence: Record<string, string | number>;
  fix: FixGuidance;
}

export interface ScanSummary {
  errors: number;
  warnings: number;
  infos: number;
  rulesRun: string[];
}

export interface ScanResult {
  schemaVersion: string;
  tool: { name: 'pragu'; version: string };
  startedAt: string;
  device: DeviceInfo;
  app: { id: string };
  screens: PamScreen[];
  issues: Issue[];
  summary: ScanSummary;
}

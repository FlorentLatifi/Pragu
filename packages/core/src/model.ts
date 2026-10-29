// The Pragu Accessibility Model (PAM): a platform-neutral description of what a
// screen exposes to assistive technology. Platform adapters (android.ts today,
// iOS later) translate native captures into it; rules only ever see PAM.

/**
 * Version of the JSON result contract written to pragu-result.json.
 * 0.2.0 added windows; 0.3.0 added `PamNode.boundsAreTouchArea`; 0.4.0 added
 * `PamNode.checked` and `stateDescription`; 0.5.0 added `PamNode.focusable`; 0.6.0 added
 * `PamNode.textEllipsized` and `PamScreen.largeText`.
 */
export const RESULT_SCHEMA_VERSION = '0.6.0';

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
  /**
   * The bounds are the element's touch area, not its drawn area. Compose reports each
   * clickable's touch area enlarged to 48 dp, and gives the overlap of two such areas to
   * the element drawn later, although a touch there goes to the nearer element.
   */
  boundsAreTouchArea: boolean;
  /** Responds to activation: tap, long press, toggle or text entry. */
  interactive: boolean;
  /** A screen reader gives it a focus stop of its own, even when it has nothing to say. */
  focusable: boolean;
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
  /** Checked or not, as a screen reader announces it; null when the element exposes no checked state. */
  checked: boolean | null;
  /** The platform's own state text, e.g. "On" or "Expanded". */
  stateDescription: string | null;
  /** Rendered text size, when the platform reports it. */
  textSizeDp: number | null;
  /** An ellipsis hides some of the text; null when the platform does not say. */
  textEllipsized: boolean | null;
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
  /** The same screen captured again with text at 200% (WCAG 1.4.4), when the scan asked for it. */
  largeText: LargeTextCapture | null;
}

/** A second capture of a screen at a larger font scale; rules compare it with the first. */
export interface LargeTextCapture {
  fontScale: number;
  windows: PamWindow[];
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

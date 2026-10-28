import type {
  AndroidCapture,
  AndroidRawNode,
  AndroidRawWindow,
  DeviceInfo,
  PamNode,
  PamScreen,
  Raster,
  Rect,
} from '../src/index.js';

export function rawNode(overrides: Partial<AndroidRawNode> = {}): AndroidRawNode {
  return {
    className: 'android.view.ViewGroup',
    packageName: 'com.example.shop',
    resourceId: null,
    text: null,
    contentDescription: null,
    hintText: null,
    labeledBy: null,
    stateDescription: null,
    roleDescription: null,
    bounds: [0, 0, 100, 100],
    clickable: false,
    longClickable: false,
    focusable: false,
    checkable: false,
    checked: false,
    enabled: true,
    editable: false,
    visibleToUser: true,
    importantForAccessibility: true,
    heading: false,
    screenReaderFocusable: false,
    actions: [],
    textSizePx: null,
    children: [],
    ...overrides,
  };
}

/** A window; by default the app's full-screen window holding `root`. */
export function windowOf(root: AndroidRawNode | null, overrides: Partial<AndroidRawWindow> = {}): AndroidRawWindow {
  return {
    type: 'application',
    layer: 0,
    title: 'Shop',
    bounds: [0, 0, 1080, 2400],
    active: true,
    focused: true,
    root,
    ...overrides,
  };
}

/** A protocol-2 capture with a single app window, unless `windows` are given. */
export function captureOf(
  root: AndroidRawNode,
  densityDpi = 160,
  windows: AndroidRawWindow[] = [windowOf(root)],
): AndroidCapture {
  return {
    protocol: 3,
    agentVersion: '0.0.3',
    capturedAt: '2026-10-27T12:00:00.000Z',
    packageName: 'com.example.shop',
    windowTitle: 'Shop',
    screenWidthPx: 1080,
    screenHeightPx: 2400,
    device: {
      manufacturer: 'Google',
      model: 'sdk_gphone64_x86_64',
      sdkInt: 36,
      release: '16',
      densityDpi,
      fontScale: 1,
      locale: 'en-US',
      nightMode: false,
    },
    windows,
  };
}

export const device: DeviceInfo = {
  platform: 'android',
  osVersion: '16',
  apiLevel: 36,
  manufacturer: 'Google',
  model: 'sdk_gphone64_x86_64',
  densityDpi: 160,
  fontScale: 1,
  locale: 'en-US',
  nightMode: false,
  screenWidthPx: 1080,
  screenHeightPx: 2400,
};

/** A PAM node at density 1 (px = dp), defaulting to a labelled 48 dp button. */
export function pamNode(overrides: Partial<PamNode> & { id: string }): PamNode {
  const boundsDp = overrides.boundsDp ?? { left: 0, top: 0, right: 48, bottom: 48 };
  return {
    parentId: null,
    childIds: [],
    role: 'button',
    platformRole: 'android.widget.Button',
    name: 'Save',
    text: null,
    hint: null,
    resourceId: null,
    boundsPx: boundsDp,
    boundsDp,
    boundsAreTouchArea: false,
    interactive: true,
    exposedToAssistiveTech: true,
    visible: true,
    obscured: false,
    inWebView: false,
    window: 0,
    enabled: true,
    checked: null,
    stateDescription: null,
    textSizeDp: null,
    ...overrides,
  };
}

export function screenOf(nodes: PamNode[]): PamScreen {
  return {
    id: 'screen-1',
    name: 'Cart',
    appId: 'com.example.shop',
    screenshot: null,
    windows: [{ kind: 'app', title: 'Shop', boundsPx: rect(0, 0, 1080, 2400), foreground: true }],
    nodes,
  };
}

export function rect(left: number, top: number, right: number, bottom: number): Rect {
  return { left, top, right, bottom };
}

export function createRaster(width: number, height: number, background: number): Raster {
  const raster: Raster = { width, height, data: new Uint8Array(width * height * 4) };
  fillRect(raster, rect(0, 0, width, height), background);
  return raster;
}

export function fillRect(raster: Raster, area: Rect, color: number): void {
  for (let y = area.top; y < area.bottom; y++) {
    for (let x = area.left; x < area.right; x++) {
      const offset = (y * raster.width + x) * 4;
      raster.data[offset] = (color >> 16) & 0xff;
      raster.data[offset + 1] = (color >> 8) & 0xff;
      raster.data[offset + 2] = color & 0xff;
      raster.data[offset + 3] = 0xff;
    }
  }
}

/**
 * Paints crude "glyphs": solid 2 px strokes with a 1 px lighter anti-aliased edge,
 * covering about a fifth of the box like real text does.
 */
export function paintText(raster: Raster, area: Rect, ink: number, antiAlias: number): void {
  for (let x = area.left + 2; x < area.right - 3; x += 8) {
    fillRect(raster, rect(x, area.top + 2, x + 2, area.bottom - 2), ink);
    fillRect(raster, rect(x + 2, area.top + 2, x + 3, area.bottom - 2), antiAlias);
  }
}

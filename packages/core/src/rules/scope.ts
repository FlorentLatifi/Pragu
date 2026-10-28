import type { PamNode } from '../model.js';

/**
 * Whether rules judge this element: visible in the app's topmost window and native.
 * Web content inside a WebView belongs to web tools such as axe-core.
 */
export function inScope(node: PamNode): boolean {
  return node.visible && !node.inWebView;
}

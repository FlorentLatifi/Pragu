import { containsRect } from '../geometry.js';
import type { LargeTextCapture, PamNode } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

// Only the ellipsis is certain. Text cut off by a fixed-height box looks the same as text
// that fits: Android clips character positions to the visible area, and since Android 14
// large text grows far less than 2x at 200%, so "it did not grow" proves nothing.

/** On screen in full in the large-text capture: text pushed below the screen is scrolling, not clipping. */
function fullyShown(node: PamNode, capture: LargeTextCapture): boolean {
  const window = capture.windows[node.window];
  return window !== undefined && inScope(node) && !node.obscured && containsRect(window.boundsPx, node.boundsPx);
}

export const textScalingTruncation: Rule = {
  meta: {
    id: 'text/scaling-truncation',
    title: 'Text is cut off at a larger font size',
    severity: 'error',
    confidence: 'high',
    wcag: ['1.4.4'],
    en301549: ['11.1.4.4'],
    whoIsAffected: 'People with low vision who make text larger in their phone’s settings.',
    whatTheyExperience: 'With larger text, the end of the text disappears behind an ellipsis, so they cannot read it.',
    fix: {
      reactNative: 'Let the text wrap: drop numberOfLines, or allow more lines, and keep allowFontScaling on.',
      compose: 'Let the text wrap instead of maxLines = 1 with TextOverflow.Ellipsis.',
      androidViews: 'Let the text wrap: avoid maxLines="1" (or singleLine) with ellipsize on text that matters.',
    },
  },
  check({ screen }) {
    const capture = screen.largeText;
    if (capture === null) return [];
    const largeById = new Map(capture.nodes.map((node) => [node.id, node]));
    return screen.nodes.flatMap((node) => {
      // Text already cut short at the normal size is a different problem from scaling.
      if (node.text === null || !inScope(node) || node.obscured || node.textEllipsized !== false) return [];
      const large = largeById.get(node.id);
      if (large?.text !== node.text || large.textEllipsized !== true || !fullyShown(large, capture)) return [];
      return [
        {
          node,
          message: `At 200% text size, "${node.text}" is cut short with an ellipsis, so the end of it cannot be read.`,
          evidence: { fontScale: capture.fontScale },
        },
      ];
    });
  },
};

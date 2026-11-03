import { estimateTextColors, formatRatio, toHex } from '../color.js';
import { rectHeight, rectWidth } from '../geometry.js';
import type { PamNode } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

const NON_TEXT_RATIO = 3;
// Below this, too few pixels to tell an icon from its anti-aliasing.
const MIN_SIZE_DP = 12;

/** Whether the element, or anything inside it, shows text: then it is contrast/text's case. */
function showsText(node: PamNode, nodes: readonly PamNode[]): boolean {
  return nodes.some(
    (other) =>
      (other === node || other.id.startsWith(`${node.id}.`)) && other.text !== null && other.text.trim() !== '',
  );
}

/**
 * WCAG 1.4.11 for icon buttons: the icon against what is around it inside the control, 3:1.
 * Scoped tightly: interactive elements with no text, read with the same estimator as
 * contrast/text, which stays silent on busy backgrounds.
 */
export const nonTextContrast: Rule = {
  meta: {
    id: 'contrast/non-text',
    title: 'Icon contrast is too low',
    severity: 'warning',
    // The estimator sees the strongest colour pair, which is usually the icon, not always.
    confidence: 'medium',
    wcag: ['1.4.11'],
    en301549: ['11.1.4.11'],
    whoIsAffected: 'People with low vision, older users, and anyone in bright light.',
    whatTheyExperience: 'They cannot make out the icon, so they cannot find the control or tell what it does.',
    fix: {
      reactNative: 'Darken the icon (its color or tintColor) until it reaches 3:1 against the background.',
      compose:
        'Use a darker tint, e.g. LocalContentColor or MaterialTheme.colorScheme.onSurfaceVariant, at 3:1 or more.',
      androidViews: 'Use a darker app:tint or android:tint on the icon, at 3:1 or more against its background.',
    },
    requires: ['screenshot'],
  },
  check({ screen, raster }) {
    if (raster === null) return [];
    return screen.nodes.flatMap((node) => {
      if (!node.interactive || !node.enabled || !inScope(node) || node.obscured || !node.exposedToAssistiveTech)
        return [];
      if (node.role === 'textfield' || showsText(node, screen.nodes)) return [];
      if (rectWidth(node.boundsDp) < MIN_SIZE_DP || rectHeight(node.boundsDp) < MIN_SIZE_DP) return [];
      const colors = estimateTextColors(raster, node.boundsPx);
      if (colors === null || colors.ratio >= NON_TEXT_RATIO) return [];
      const foreground = toHex(colors.foreground);
      const background = toHex(colors.background);
      return [
        {
          node,
          message: `This control's icon has a contrast of ${formatRatio(colors.ratio)}:1 (${foreground} on ${background}); icons and controls need 3:1.`,
          evidence: { ratio: Number(formatRatio(colors.ratio)), required: NON_TEXT_RATIO, foreground, background },
        },
      ];
    });
  },
};

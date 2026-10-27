import { estimateTextColors, formatRatio, toHex } from '../color.js';
import type { Confidence, PamNode } from '../model.js';
import type { Finding, Rule } from './types.js';

/** WCAG 1.4.3 sets no contrast requirement for text that is part of an inactive (disabled) component. */
function isInsideInactiveComponent(node: PamNode, byId: ReadonlyMap<string, PamNode>): boolean {
  for (let current: PamNode | undefined = node; current !== undefined;) {
    if (!current.enabled) return true;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

const NORMAL_TEXT_RATIO = 4.5;
const LARGE_TEXT_RATIO = 3;
/** WCAG "large text": 18pt = 24 CSS px, or 14pt bold = 18.66 CSS px. One CSS px ≈ one dp. */
const LARGE_TEXT_DP = 24;
const LARGE_BOLD_TEXT_DP = 18.66;

/**
 * The required ratio depends on text size, and the weight is invisible to us.
 * Text between the two thresholds might be bold, so only the lenient large-text
 * ratio is certain there and confidence drops.
 */
export function requiredTextRatio(textSizeDp: number | null): { required: number; confidence: Confidence } {
  if (textSizeDp === null) return { required: NORMAL_TEXT_RATIO, confidence: 'medium' };
  if (textSizeDp >= LARGE_TEXT_DP) return { required: LARGE_TEXT_RATIO, confidence: 'high' };
  if (textSizeDp >= LARGE_BOLD_TEXT_DP) return { required: LARGE_TEXT_RATIO, confidence: 'medium' };
  return { required: NORMAL_TEXT_RATIO, confidence: 'high' };
}

export const textContrast: Rule = {
  meta: {
    id: 'contrast/text',
    title: 'Text contrast is too low',
    severity: 'error',
    confidence: 'high',
    wcag: ['1.4.3'],
    en301549: ['11.1.4.3'],
    whoIsAffected:
      'People with low vision or colour-vision deficiencies, older users, and anyone reading in bright light.',
    whatTheyExperience: 'The text fades into its background and is hard or impossible to read.',
    fix: {
      reactNative:
        "Darken the text or lighten the background until the ratio reaches 4.5:1 (3:1 for large text), e.g. color: '#595959' on white.",
      compose:
        'Use a darker colour from your theme, e.g. MaterialTheme.colorScheme.onSurfaceVariant, and check it at 4.5:1.',
      androidViews: 'Use a darker android:textColor, or a lighter background, until the ratio reaches 4.5:1.',
    },
  },
  check({ screen, raster }) {
    if (raster === null) return [];
    const findings: Finding[] = [];
    const byId = new Map(screen.nodes.map((node) => [node.id, node]));
    for (const node of screen.nodes) {
      if (!node.visible || node.text === null || isInsideInactiveComponent(node, byId)) continue;
      const colors = estimateTextColors(raster, node.boundsPx);
      if (colors === null) continue;
      const { required, confidence } = requiredTextRatio(node.textSizeDp);
      if (colors.ratio >= required) continue;
      const foreground = toHex(colors.foreground);
      const background = toHex(colors.background);
      findings.push({
        node,
        message: `"${node.text}" has a contrast of ${formatRatio(colors.ratio)}:1 (${foreground} on ${background}); text this size needs ${String(required)}:1.`,
        evidence: {
          ratio: Number(formatRatio(colors.ratio)),
          required,
          foreground,
          background,
          textSizeDp: node.textSizeDp ?? 'unknown',
        },
        confidence,
      });
    }
    return findings;
  },
};

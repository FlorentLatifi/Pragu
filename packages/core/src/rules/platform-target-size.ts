import { rectHeight, rectWidth } from '../geometry.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

const WCAG_MIN_DP = 24;
const ANDROID_MIN_DP = 48;
// Bounds come in whole pixels; 47.6 dp on a 420 dpi screen is a 48 dp control rounded down.
const ROUNDING_DP = 0.5;

function formatDp(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Targets that pass WCAG 2.5.8 (24 dp) but miss Android's own 48 dp guidance, one level
 * below `target/size` (ADR-007). A separate rule id, so the bench measures it on its own.
 * Compose reports touch areas, so a control Compose already enlarged to 48 dp passes by itself.
 */
export const platformTargetSize: Rule = {
  meta: {
    id: 'target/platform-size',
    title: 'Touch target is smaller than Android’s 48 dp',
    severity: 'info',
    // React Native's hitSlop and Android's TouchDelegate enlarge touch areas invisibly to the tree.
    confidence: 'medium',
    wcag: [],
    en301549: [],
    whoIsAffected: 'People with tremors or limited dexterity, and anyone using a phone one-handed or on the move.',
    whatTheyExperience:
      'They miss the target or hit its neighbour more often than with a 48 dp target, and have to try again.',
    fix: {
      reactNative: 'Give the pressable minWidth: 48 and minHeight: 48, or padding around the icon.',
      compose:
        'Keep Modifier.minimumInteractiveComponentSize() (Material components apply it), or size the control to 48.dp.',
      androidViews: 'Set android:minWidth and android:minHeight to 48dp, or add padding around the icon.',
    },
  },
  check({ screen }) {
    return screen.nodes.flatMap((node) => {
      if (!node.interactive || !inScope(node) || !node.enabled || !node.exposedToAssistiveTech) return [];
      if (node.role === 'textfield') return [];
      const width = rectWidth(node.boundsDp);
      const height = rectHeight(node.boundsDp);
      // Under 24 dp is target/size's finding; at 48 dp or more there is nothing to say.
      if (Math.min(width, height) < WCAG_MIN_DP || Math.min(width, height) >= ANDROID_MIN_DP - ROUNDING_DP) return [];
      return [
        {
          node,
          message: `This target is ${formatDp(width)}×${formatDp(height)} dp: it passes WCAG’s 24 dp minimum, but Android recommends at least 48×48 dp.`,
          evidence: { widthDp: Math.round(width * 10) / 10, heightDp: Math.round(height * 10) / 10 },
        },
      ];
    });
  },
};

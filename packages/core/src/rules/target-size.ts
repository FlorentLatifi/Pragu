import { circleIntersectsRect, rectCenter, rectGap, rectHeight, rectWidth } from '../geometry.js';
import type { PamNode } from '../model.js';
import { inScope } from './scope.js';
import type { Finding, Rule } from './types.js';

/** WCAG 2.5.8 minimum: 24×24 CSS px. A CSS px and a dp are both ~1/160 inch, so 24 dp. */
const MIN_TARGET_DP = 24;
const SPACING_RADIUS_DP = MIN_TARGET_DP / 2;

function isUndersized(node: PamNode): boolean {
  return rectWidth(node.boundsDp) < MIN_TARGET_DP || rectHeight(node.boundsDp) < MIN_TARGET_DP;
}

function isAncestorOf(ancestor: PamNode, node: PamNode): boolean {
  return node.id.startsWith(`${ancestor.id}.`);
}

function formatDp(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export const targetSize: Rule = {
  meta: {
    id: 'target/size',
    title: 'Touch target is too small',
    // A warning until Pragu can see hitSlop (ADR-007): React Native enlarges touch areas in
    // JavaScript, invisibly to the accessibility tree, so some flagged targets really pass.
    severity: 'warning',
    // React Native hitSlop and Android TouchDelegate can enlarge the real touch area invisibly.
    confidence: 'medium',
    wcag: ['2.5.8'],
    // EN 301 549 v3.2.1 predates WCAG 2.2, so it has no clause for 2.5.8 yet.
    en301549: [],
    whoIsAffected:
      'People with tremors or limited dexterity, people with large fingers, and anyone using a phone one-handed or on the move.',
    whatTheyExperience: 'They miss the control or hit the one next to it by accident.',
    fix: {
      reactNative:
        'Make the pressable at least 24×24 dp (Android recommends 48×48 dp) with minWidth/minHeight or padding. hitSlop enlarges the touch area, but accessibility tools cannot see it.',
      compose: 'Use Modifier.minimumInteractiveComponentSize(), or size the control to at least 48.dp.',
      androidViews: 'Set android:minWidth and android:minHeight to 48dp, or add padding around the icon.',
    },
  },
  check({ screen }) {
    const targets = screen.nodes.filter(
      (node) => node.interactive && inScope(node) && node.enabled && node.exposedToAssistiveTech,
    );
    const undersized = new Set(targets.filter(isUndersized).map((node) => node.id));
    const findings: Finding[] = [];

    for (const target of targets) {
      if (!undersized.has(target.id)) continue;
      // WCAG spacing exception: an undersized target passes if a 24 dp circle centred on it
      // touches no other target and no other undersized target's circle.
      const center = rectCenter(target.boundsDp);
      const conflicts = targets.filter((other) => {
        if (other.id === target.id || isAncestorOf(other, target) || isAncestorOf(target, other)) return false;
        if (undersized.has(other.id)) {
          const otherCenter = rectCenter(other.boundsDp);
          return Math.hypot(center.x - otherCenter.x, center.y - otherCenter.y) < 2 * SPACING_RADIUS_DP;
        }
        return circleIntersectsRect(center.x, center.y, SPACING_RADIUS_DP, other.boundsDp);
      });
      if (conflicts.length === 0) continue;

      const gap = Math.min(...conflicts.map((other) => rectGap(target.boundsDp, other.boundsDp)));
      const width = rectWidth(target.boundsDp);
      const height = rectHeight(target.boundsDp);
      findings.push({
        node: target,
        message: `This target is ${formatDp(width)}×${formatDp(height)} dp and another target is ${formatDp(gap)} dp away. It needs to be at least ${String(MIN_TARGET_DP)}×${String(MIN_TARGET_DP)} dp, or have that much space around it.`,
        evidence: {
          widthDp: Math.round(width * 10) / 10,
          heightDp: Math.round(height * 10) / 10,
          minimumDp: MIN_TARGET_DP,
          nearestTargetGapDp: Math.round(gap * 10) / 10,
        },
      });
    }
    return findings;
  },
};

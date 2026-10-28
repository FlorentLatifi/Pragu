import type { PamNode } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

/**
 * A hidden control inside a row that is itself one accessible control is a common,
 * correct pattern: the row offers the action. Only a control with no such ancestor
 * is out of reach.
 */
function insideReachableControl(node: PamNode, byId: ReadonlyMap<string, PamNode>): boolean {
  for (let id = node.parentId; id !== null;) {
    const ancestor = byId.get(id);
    if (ancestor === undefined) return false;
    if (ancestor.exposedToAssistiveTech && (ancestor.interactive || ancestor.focusable)) return true;
    id = ancestor.parentId;
  }
  return false;
}

export const focusUnreachable: Rule = {
  meta: {
    id: 'focus/unreachable',
    title: 'Control is hidden from assistive technology',
    severity: 'error',
    confidence: 'high',
    wcag: ['2.1.1', '4.1.2'],
    en301549: ['11.2.1.1', '11.4.1.2'],
    whoIsAffected: 'People who use a screen reader, Switch Access, a keyboard or voice control.',
    whatTheyExperience:
      'The control is on screen and works by touch, but their assistive technology skips it, so they can never use it.',
    fix: {
      reactNative:
        'Remove importantForAccessibility="no" (or "no-hide-descendants") and accessibilityElementsHidden from the control and its parents.',
      compose:
        'Remove hideFromAccessibility() or clearAndSetSemantics {} from the control, or give the action to a parent that stays visible.',
      androidViews:
        'Remove android:importantForAccessibility="no" (or "noHideDescendants") from the control and its parents.',
    },
  },
  check({ screen }) {
    const byId = new Map(screen.nodes.map((node) => [node.id, node]));
    return screen.nodes
      .filter(
        (node) =>
          node.interactive &&
          node.enabled &&
          !node.exposedToAssistiveTech &&
          inScope(node) &&
          !insideReachableControl(node, byId),
      )
      .map((node) => ({
        node,
        message:
          'This control responds to touch but is hidden from assistive technology, so screen readers, Switch Access and keyboards never reach it.',
        evidence: { role: node.role, platformRole: node.platformRole },
      }));
  },
};

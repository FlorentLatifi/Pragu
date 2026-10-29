import type { PamNode, Role } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

const SPOKEN_ROLE: Partial<Record<Role, string>> = {
  button: 'button',
  link: 'link',
  switch: 'switch',
  checkbox: 'checkbox',
  radio: 'radio button',
  tab: 'tab',
  slider: 'slider',
};

function isAncestor(ancestor: PamNode, node: PamNode): boolean {
  return node.id.startsWith(`${ancestor.id}.`);
}

/** Names compare as a person hears them: case and surrounding spaces do not matter. */
function spokenName(node: PamNode): string {
  return (node.name ?? '').trim().toLowerCase();
}

export const duplicateName: Rule = {
  meta: {
    id: 'name/duplicate',
    title: 'Several controls have the same name',
    severity: 'warning',
    // Sometimes two controls really do the same thing; the rule cannot tell, so it warns.
    confidence: 'medium',
    wcag: ['2.4.6'],
    en301549: ['11.2.4.6'],
    whoIsAffected: 'People who use a screen reader or voice control.',
    whatTheyExperience:
      'Moving from control to control they hear the same name again and again, and cannot tell which item each one acts on. Voice control users cannot say which one they mean.',
    fix: {
      reactNative: 'Name each one after what it acts on, e.g. accessibilityLabel={`Remove ${item.name}`}.',
      compose: 'Name each one after what it acts on, e.g. contentDescription = "Remove ${item.name}".',
      androidViews: 'Set a distinct android:contentDescription per row, e.g. "Remove " + item.name in the adapter.',
    },
  },
  check({ screen }) {
    const controls = screen.nodes.filter(
      (node) =>
        node.interactive &&
        node.role !== 'textfield' &&
        node.name !== null &&
        inScope(node) &&
        node.exposedToAssistiveTech,
    );
    return controls.flatMap((node) => {
      // A row and a control inside it can share words; they are one place, not two.
      const twins = controls.filter(
        (other) =>
          other !== node &&
          other.window === node.window &&
          spokenName(other) === spokenName(node) &&
          !isAncestor(other, node) &&
          !isAncestor(node, other),
      );
      if (twins.length === 0) return [];
      const kind = SPOKEN_ROLE[node.role] ?? 'control';
      const others = twins.length === 1 ? '1 other control' : `${String(twins.length)} other controls`;
      return [
        {
          node,
          message: `This ${kind} has the same name as ${others} on this screen: "${node.name ?? ''}". A screen reader user hears it ${String(twins.length + 1)} times and cannot tell which item each one acts on.`,
          evidence: { name: node.name ?? '', sameName: twins.length + 1 },
        },
      ];
    });
  },
};

import type { PamNode, PamScreen, Rect } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

/** How far from a field a visible label may sit, above it or to its left. */
const LABEL_REACH_DP = 24;

function gapAbove(field: Rect, text: Rect): number | null {
  const overlaps = text.left < field.right && text.right > field.left;
  const gap = field.top - text.bottom;
  return overlaps && gap >= 0 && gap <= LABEL_REACH_DP ? gap : null;
}

function gapLeft(field: Rect, text: Rect): number | null {
  const overlaps = text.top < field.bottom && text.bottom > field.top;
  const gap = field.left - text.right;
  return overlaps && gap >= 0 && gap <= LABEL_REACH_DP ? gap : null;
}

/**
 * The text a sighted person would read as the field's label: the nearest text just
 * above it or to its left. It only makes the message more useful; detection never uses it.
 */
function visibleLabel(field: PamNode, screen: PamScreen): string | null {
  let nearest: { text: string; gap: number } | null = null;
  for (const node of screen.nodes) {
    if (node.role !== 'text' || node.text === null || node.window !== field.window || !inScope(node)) continue;
    const gap = gapAbove(field.boundsDp, node.boundsDp) ?? gapLeft(field.boundsDp, node.boundsDp);
    if (gap !== null && (nearest === null || gap < nearest.gap)) nearest = { text: node.text, gap };
  }
  return nearest?.text ?? null;
}

export const inputMissingLabel: Rule = {
  meta: {
    id: 'input/missing-label',
    title: 'Text field has no label',
    severity: 'error',
    confidence: 'high',
    wcag: ['1.3.1', '4.1.2'],
    en301549: ['11.1.3.1', '11.4.1.2'],
    whoIsAffected: 'People who use a screen reader (TalkBack, VoiceOver) or voice control.',
    whatTheyExperience:
      'The screen reader says only "Edit box", so they have to guess what goes in the field. Voice control users have no name to say to move into it.',
    fix: {
      reactNative:
        'Connect the visible label: <Text nativeID="promo-label">Promo code</Text> and <TextInput aria-labelledby="promo-label" />, or set accessibilityLabel="Promo code".',
      compose:
        'Pass a label that stays visible: OutlinedTextField(value, onValueChange, label = { Text("Promo code") }).',
      androidViews:
        'Point the visible label at the field with android:labelFor="@id/promo_code", or wrap the field in a TextInputLayout with android:hint.',
    },
  },
  check({ screen }) {
    return screen.nodes
      .filter((node) => node.role === 'textfield' && inScope(node) && node.exposedToAssistiveTech && node.name === null)
      .map((node) => {
        const label = visibleLabel(node, screen);
        const message =
          label === null
            ? 'This text field has no label. A screen reader announces only "Edit box", so people have to guess what to enter.'
            : `This text field has no label. A screen reader announces only "Edit box": the text "${label}" next to it is not connected to it.`;
        const evidence: Record<string, string> = { platformRole: node.platformRole };
        if (label !== null) evidence.visibleText = label;
        return { node, message, evidence };
      });
  },
};

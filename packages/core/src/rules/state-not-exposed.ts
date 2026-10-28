import type { Role } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

// Roles that promise a state. A control that takes one of them but exposes no state
// makes TalkBack name the kind of control and stop there.
const MESSAGES: Partial<Record<Role, string>> = {
  checkbox:
    'This checkbox never says whether it is checked. A screen reader announces "Checkbox" but not "checked" or "not checked", so people cannot tell what they chose.',
  switch:
    'This switch never says whether it is on. A screen reader announces "Switch" but not "on" or "off", so people cannot tell what they chose.',
  radio:
    'This radio button never says whether it is selected. A screen reader announces "Radio button" but not "selected", so people cannot tell what they chose.',
};

export const stateNotExposed: Rule = {
  meta: {
    id: 'state/not-exposed',
    title: 'Control does not expose its state',
    severity: 'error',
    confidence: 'high',
    wcag: ['4.1.2'],
    en301549: ['11.4.1.2'],
    whoIsAffected: 'People who use a screen reader (TalkBack, VoiceOver).',
    whatTheyExperience:
      'They hear what kind of control it is, but not whether it is checked or on, so they cannot tell what they chose or whether their tap did anything.',
    fix: {
      reactNative:
        'Pass the state with the role, e.g. <Pressable accessibilityRole="checkbox" aria-checked={checked}>, or use React Native\'s Switch.',
      compose:
        'Use Modifier.toggleable(value = checked, role = Role.Checkbox, onValueChange = { … }) instead of clickable, or the Material Checkbox and Switch.',
      androidViews:
        'Extend CheckBox, SwitchCompat or another CompoundButton, or set isCheckable and isChecked in onInitializeAccessibilityNodeInfo.',
    },
  },
  check({ screen }) {
    return screen.nodes.flatMap((node) => {
      const message = MESSAGES[node.role];
      const exposesState = node.checked !== null || node.stateDescription !== null;
      if (
        message === undefined ||
        exposesState ||
        !node.interactive ||
        !inScope(node) ||
        !node.exposedToAssistiveTech
      ) {
        return [];
      }
      return [{ node, message, evidence: { role: node.role, platformRole: node.platformRole } }];
    });
  },
};

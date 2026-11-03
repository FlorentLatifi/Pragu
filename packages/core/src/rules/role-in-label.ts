import type { Role } from '../model.js';
import { inScope } from './scope.js';
import type { Rule } from './types.js';

// The words TalkBack already says for each role, so a name that repeats one is heard twice.
const ROLE_WORDS: Partial<Record<Role, readonly string[]>> = {
  button: ['button'],
  link: ['link'],
  checkbox: ['checkbox', 'check box'],
  switch: ['switch', 'toggle'],
  radio: ['radio button'],
  tab: ['tab'],
  image: ['image'],
};

/** The role word the name repeats, as a whole word, or null. */
export function repeatedRoleWord(name: string, role: Role): string | null {
  const words = ROLE_WORDS[role] ?? [];
  const lower = name.toLowerCase();
  return words.find((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(lower)) ?? null;
}

export const roleInLabel: Rule = {
  meta: {
    id: 'name/role-in-label',
    title: 'Name repeats the control’s role',
    severity: 'info',
    // Clear when it happens, and only ever costs a few words of listening.
    confidence: 'high',
    wcag: [],
    en301549: [],
    whoIsAffected: 'People who use a screen reader.',
    whatTheyExperience:
      'They hear the role twice, as in "Delete button, Button", which slows every pass through the screen and sounds careless.',
    fix: {
      reactNative:
        'Leave the role out of accessibilityLabel: "Delete", with accessibilityRole="button" saying the rest.',
      compose:
        'Leave the role out of contentDescription: "Delete"; Role.Button or the component already says "Button".',
      androidViews:
        'Leave the role out of android:contentDescription: "Delete"; the Button class already says "Button".',
    },
  },
  check({ screen }) {
    return screen.nodes.flatMap((node) => {
      if (node.name === null || !inScope(node) || !node.exposedToAssistiveTech) return [];
      const word = repeatedRoleWord(node.name, node.role);
      // A name that is nothing but the role word says nothing at all: that is name/generic's case.
      if (word === null || node.name.trim().toLowerCase() === word) return [];
      return [
        {
          node,
          message: `The name "${node.name}" repeats the role, so a screen reader says "${word}" twice.`,
          evidence: { role: node.role, repeatedWord: word },
        },
      ];
    });
  },
};

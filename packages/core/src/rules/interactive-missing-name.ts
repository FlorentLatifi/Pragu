import type { Role } from '../model.js';
import type { Rule } from './types.js';

const SPOKEN_ROLE: Partial<Record<Role, string>> = {
  button: 'Button',
  link: 'Link',
  switch: 'Switch',
  checkbox: 'Checkbox',
  radio: 'Radio button',
  tab: 'Tab',
  slider: 'Slider',
  image: 'Image',
};

export const interactiveMissingName: Rule = {
  meta: {
    id: 'name/interactive-missing',
    title: 'Interactive element has no accessible name',
    severity: 'error',
    confidence: 'high',
    wcag: ['4.1.2'],
    en301549: ['11.4.1.2'],
    whoIsAffected: 'People who use a screen reader (TalkBack, VoiceOver) or voice control.',
    whatTheyExperience:
      'The screen reader announces only what kind of control it is, so they cannot tell what it does. Voice control users have no name to say.',
    fix: {
      reactNative: 'Describe the action with accessibilityLabel, e.g. <Pressable accessibilityLabel="Remove item">.',
      compose: 'Give the icon a contentDescription, or add Modifier.semantics { contentDescription = "Remove item" }.',
      androidViews: 'Set android:contentDescription="@string/remove_item" on the button or ImageButton.',
    },
  },
  check({ screen }) {
    return screen.nodes
      .filter(
        (node) =>
          node.interactive &&
          node.visible &&
          node.exposedToAssistiveTech &&
          // Text fields are covered by input/missing-label, which explains labels vs placeholders.
          node.role !== 'textfield' &&
          node.name === null,
      )
      .map((node) => {
        const spoken = SPOKEN_ROLE[node.role];
        const message =
          spoken === undefined
            ? 'This control has no accessible name. A screen reader can only say that it can be activated.'
            : `This ${spoken.toLowerCase()} has no accessible name. A screen reader can only announce "${spoken}".`;
        return { node, message, evidence: { role: node.role, platformRole: node.platformRole } };
      });
  },
};

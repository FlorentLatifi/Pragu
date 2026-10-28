import { inScope } from './scope.js';
import type { Rule } from './types.js';

// Only images that TalkBack stops on: an unnamed image it skips may be decorative, and
// telling decoration from content is a guess. Interactive images belong to
// name/interactive-missing.
export const imageMissingName: Rule = {
  meta: {
    id: 'name/image-missing',
    title: 'Image has no accessible name',
    severity: 'error',
    confidence: 'high',
    wcag: ['1.1.1'],
    en301549: ['11.1.1.1'],
    whoIsAffected: 'People who use a screen reader (TalkBack, VoiceOver).',
    whatTheyExperience:
      'The screen reader stops on the image and says only "Image", so they miss what it shows and wonder what they skipped.',
    fix: {
      reactNative:
        'Describe what it shows with accessibilityLabel="Mug in sage green", or remove accessible if the image is decorative so TalkBack skips it.',
      compose:
        'Pass contentDescription = "Mug in sage green" to Image, or contentDescription = null if it is decorative.',
      androidViews: 'Set android:contentDescription, or android:importantForAccessibility="no" on a decorative image.',
    },
  },
  check({ screen }) {
    return screen.nodes
      .filter(
        (node) =>
          node.role === 'image' &&
          node.focusable &&
          !node.interactive &&
          node.name === null &&
          inScope(node) &&
          node.exposedToAssistiveTech,
      )
      .map((node) => ({
        node,
        message:
          'A screen reader stops on this image but can only announce "Image". Describe what it shows, or let the screen reader skip it if it is decorative.',
        evidence: { role: node.role, platformRole: node.platformRole },
      }));
  },
};

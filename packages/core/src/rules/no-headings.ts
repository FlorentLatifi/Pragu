import type { Rule } from './types.js';

/** Below this many texts a screen is short enough to swipe through; headings would add little. */
export const MIN_TEXTS_FOR_HEADINGS = 8;

export const noHeadings: Rule = {
  meta: {
    id: 'structure/no-headings',
    title: 'Screen has no headings',
    severity: 'info',
    // A long screen with no heading is easy to see; whether it has sections that need one is a judgement.
    confidence: 'low',
    wcag: ['1.3.1', '2.4.6'],
    en301549: ['11.1.3.1', '11.2.4.6'],
    whoIsAffected: 'People who use a screen reader.',
    whatTheyExperience:
      'They cannot jump from section to section with TalkBack’s heading navigation, so they swipe through every item to find the part they want.',
    fix: {
      reactNative: 'Mark section titles with accessibilityRole="header".',
      compose: 'Mark section titles with Modifier.semantics { heading() }.',
      androidViews:
        'Set android:accessibilityHeading="true" on section titles (API 28+), or ViewCompat.setAccessibilityHeading.',
    },
  },
  check({ screen }) {
    const foreground = screen.windows.findIndex((window) => window.foreground);
    const nodes = screen.nodes.filter((node) => node.window === foreground && node.visible && !node.inWebView);
    if (nodes.some((node) => node.role === 'heading')) return [];
    const texts = nodes.filter((node) => node.text !== null && node.text.trim() !== '' && node.exposedToAssistiveTech);
    // The finding belongs to the screen, so it is reported on the window's root element.
    const root = nodes[0];
    if (texts.length < MIN_TEXTS_FOR_HEADINGS || root === undefined) return [];
    return [
      {
        node: root,
        message: `This screen shows ${String(texts.length)} texts and no heading, so a screen reader user cannot jump between its sections.`,
        evidence: { texts: texts.length },
      },
    ];
  },
};

import { inScope } from './scope.js';
import type { Rule } from './types.js';

// Names that say nothing about the purpose. Kept short on purpose: "Close", "Back" and "More
// options" are fine names, and a false alarm costs more trust than a missed one.
const GENERIC = new Set([
  'button',
  'image',
  'icon',
  'picture',
  'link',
  'checkbox',
  'switch',
  'tab',
  'click here',
  'tap here',
  'click',
  'tap',
  'here',
  'unlabeled',
  'unlabelled',
  'untitled',
]);

/** Why a name says nothing, or null when it is a real name. */
export function genericReason(name: string): string | null {
  const normal = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (GENERIC.has(normal)) return 'it says only what the thing is, not what it does';
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(normal)) return 'it is a file name';
  // Resource-like: ic_close, img_1234, btn-submit, button1, image23.
  if (/^(ic|img|icon|btn|image|button|iv|imageview)[_-][a-z0-9_-]*$/.test(normal)) return 'it is a resource name';
  if (/^(button|image|img|icon|btn)\d+$/.test(normal)) return 'it is a resource name';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(normal)) return 'it is a code identifier';
  return null;
}

export const genericName: Rule = {
  meta: {
    id: 'name/generic',
    title: 'Name does not say what the control does',
    severity: 'warning',
    confidence: 'medium',
    wcag: ['2.4.4', '2.4.6'],
    en301549: ['11.2.4.4', '11.2.4.6'],
    whoIsAffected: 'People who use a screen reader or voice control.',
    whatTheyExperience:
      'They hear a name such as "Button", "Icon" or "ic_close" and still cannot tell what the control does without trying it.',
    fix: {
      reactNative: 'Name the action: accessibilityLabel="Add to wishlist", not "Icon" or the image file name.',
      compose: 'Name the action: contentDescription = "Add to wishlist", not "Icon" or a resource name.',
      androidViews:
        'Name the action in android:contentDescription, e.g. "@string/add_to_wishlist", not the drawable name.',
    },
  },
  check({ screen }) {
    return screen.nodes.flatMap((node) => {
      // Unnamed controls are name/interactive-missing's; only controls and images TalkBack stops on count here.
      if (node.name === null || !inScope(node) || !node.exposedToAssistiveTech) return [];
      if (!node.interactive && node.role !== 'image') return [];
      const reason = genericReason(node.name);
      if (reason === null) return [];
      return [
        {
          node,
          message: `The name "${node.name}" does not say what this does: ${reason}.`,
          evidence: { role: node.role },
        },
      ];
    });
  },
};

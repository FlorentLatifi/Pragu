// What a screen reader says when someone swipes through the screen: Pragu's approximation
// of TalkBack's reading order and wording. Labelled as an approximation wherever it is shown;
// a real device can differ.

import type { PamNode, PamScreen, Role } from './model.js';

export interface TranscriptLine {
  nodeId: string;
  text: string;
}

const ROLE_WORDS: Partial<Record<Role, string>> = {
  button: 'Button',
  link: 'Link',
  image: 'Image',
  heading: 'Heading',
  textfield: 'Edit box',
  switch: 'Switch',
  checkbox: 'Checkbox',
  radio: 'Radio button',
  tab: 'Tab',
  slider: 'Slider',
  progressbar: 'Progress bar',
};

function stateWords(node: PamNode): string | null {
  if (node.stateDescription !== null) return node.stateDescription;
  if (node.checked === null) return null;
  if (node.role === 'switch') return node.checked ? 'On' : 'Off';
  return node.checked ? 'checked' : 'not checked';
}

/** What TalkBack would say for one focus stop: name, role, state, in that order. */
export function announce(node: PamNode): string {
  const role = ROLE_WORDS[node.role];
  const named = node.name !== null;
  // A control with no name and no role still gets a focus stop: TalkBack has nothing to say there.
  const unnamedControl = role !== undefined || node.interactive || node.focusable;
  const parts = [named ? node.name : unnamedControl ? 'Unlabelled' : null, role ?? null, stateWords(node)];
  if (!node.enabled) parts.push('disabled');
  return parts.filter((part): part is string => part !== null && part !== '').join(', ');
}

/**
 * A node TalkBack stops on: it is in the foreground app window, visible and exposed, and
 * either has a focus stop of its own or has something to say while no focusable ancestor
 * reads it out instead.
 */
function isFocusStop(node: PamNode, byId: ReadonlyMap<string, PamNode>, foreground: number): boolean {
  if (node.window !== foreground || !node.visible || !node.exposedToAssistiveTech || node.inWebView) return false;
  if (node.focusable) return true;
  if (node.name === null) return false;
  for (let id = node.parentId; id !== null;) {
    const ancestor = byId.get(id);
    if (ancestor === undefined) break;
    if (ancestor.focusable && ancestor.exposedToAssistiveTech) return false;
    id = ancestor.parentId;
  }
  return true;
}

/** The focus stops in traversal order (the accessibility tree, depth first), as spoken lines. */
export function transcript(screen: PamScreen): TranscriptLine[] {
  const foreground = screen.windows.findIndex((window) => window.foreground);
  const byId = new Map(screen.nodes.map((node) => [node.id, node]));
  return screen.nodes
    .filter((node) => isFocusStop(node, byId, foreground))
    .map((node) => ({ nodeId: node.id, text: announce(node) }))
    .filter((line) => line.text !== '');
}

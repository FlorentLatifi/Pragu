import type { PamNode } from './model.js';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** 64-bit FNV-1a over the UTF-8 bytes of `input`, as 16 hex characters. Fast, stable, not cryptographic. */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

/** A wrapper that only lays things out: adding or removing one must not change a fingerprint. */
function isLayoutOnly(node: PamNode): boolean {
  return node.role === 'container' && !node.interactive && node.name === null && node.resourceId === null;
}

/**
 * Where an element sits, by meaning rather than pixels: from the root, each meaningful
 * element's role and its position among same-role siblings. Layout-only wrappers are
 * skipped, so restyling the layout keeps the path.
 */
function structuralPath(node: PamNode, byId: ReadonlyMap<string, PamNode>): string {
  const segments: string[] = [];
  for (let current: PamNode | undefined = node; current !== undefined;) {
    const parent: PamNode | undefined = current.parentId === null ? undefined : byId.get(current.parentId);
    if (!isLayoutOnly(current)) {
      const role = current.role;
      const siblings = parent?.childIds.map((id) => byId.get(id)).filter((sibling) => sibling?.role === role) ?? [];
      const position = Math.max(
        0,
        siblings.findIndex((sibling) => sibling?.id === current?.id),
      );
      segments.unshift(`${role}[${String(position)}]`);
    }
    current = parent;
  }
  return segments.join('/');
}

/**
 * How a baseline recognises an element across scans (ADR-004, v1), in order of
 * preference: the developer's id, then role and accessible name, then its structural path.
 */
export function elementKey(node: PamNode, byId: ReadonlyMap<string, PamNode>): string {
  if (node.resourceId !== null) return `id:${node.resourceId}`;
  if (node.name !== null) return `name:${node.role}|${node.name}`;
  return `path:${structuralPath(node, byId)}`;
}

/** Stable across layout shifts, unrelated edits and re-runs; different for another rule, element or screen. */
export function issueFingerprint(
  ruleId: string,
  appId: string,
  screenName: string,
  node: PamNode,
  byId: ReadonlyMap<string, PamNode> = new Map(),
): string {
  return fnv1a64([ruleId, appId, screenName, elementKey(node, byId)].join('\u0000'));
}

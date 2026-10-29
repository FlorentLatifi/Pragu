import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { elementKey, issueFingerprint } from '../src/index.js';
import type { PamNode, Role } from '../src/index.js';
import { pamNode, rect } from './helpers.js';

interface Spec {
  parent: number;
  role: Role;
  resourceId: string | null;
  name: string | null;
}

const ROLES: Role[] = ['button', 'text', 'image', 'container', 'checkbox', 'textfield'];

/** Random trees: each node's parent comes earlier, so the first node is the root. */
const trees = fc
  .array(
    fc.record({
      parent: fc.nat(),
      role: fc.constantFrom(...ROLES),
      resourceId: fc.option(fc.constantFrom('save', 'remove', 'promo', 'total'), { nil: null }),
      name: fc.option(fc.constantFrom('Save', 'Remove item', '€14.00', 'Close'), { nil: null }),
    }),
    { minLength: 2, maxLength: 12 },
  )
  .map((specs) => build(specs));

function build(specs: Spec[]): PamNode[] {
  const nodes: PamNode[] = [];
  specs.forEach((spec, index) => {
    const parent = index === 0 ? undefined : nodes[spec.parent % index];
    const id = parent === undefined ? '0' : `${parent.id}.${String(parent.childIds.length)}`;
    const node = pamNode({
      id,
      parentId: parent?.id ?? null,
      role: spec.role,
      interactive: spec.role === 'button' || spec.role === 'checkbox',
      resourceId: spec.resourceId,
      name: spec.name,
      text: spec.name,
      boundsDp: rect(index * 4, index * 8, index * 4 + 48, index * 8 + 48),
    });
    parent?.childIds.push(id);
    nodes.push(node);
  });
  return nodes;
}

const fingerprints = (nodes: readonly PamNode[]) => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => issueFingerprint('name/interactive-missing', 'com.example.shop', 'Cart', node, byId));
};

const clone = (nodes: readonly PamNode[]) => nodes.map((node) => ({ ...node, childIds: [...node.childIds] }));

describe('issue fingerprints (ADR-004 v1)', () => {
  it('are deterministic', () => {
    fc.assert(
      fc.property(trees, (nodes) => {
        expect(fingerprints(clone(nodes))).toEqual(fingerprints(nodes));
      }),
    );
  });

  it('survive moving everything on screen', () => {
    fc.assert(
      fc.property(trees, fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 }), (nodes, dx, dy) => {
        const moved = clone(nodes).map((node) => ({
          ...node,
          boundsDp: rect(
            node.boundsDp.left + dx,
            node.boundsDp.top + dy,
            node.boundsDp.right + dx,
            node.boundsDp.bottom + dy,
          ),
        }));
        expect(fingerprints(moved)).toEqual(fingerprints(nodes));
      }),
    );
  });

  it("survive another element's text changing", () => {
    fc.assert(
      fc.property(trees, fc.nat(), (nodes, pick) => {
        const edited = clone(nodes);
        const target = edited[pick % edited.length];
        if (target !== undefined) target.text = 'Changed copy';
        const before = fingerprints(nodes);
        const after = fingerprints(edited);
        edited.forEach((node, index) => {
          if (node !== target) expect(after[index]).toBe(before[index]);
        });
      }),
    );
  });

  it('survive a new element added at the end of any list', () => {
    fc.assert(
      fc.property(trees, fc.nat(), fc.constantFrom(...ROLES), (nodes, pick, role) => {
        const grown = clone(nodes);
        const parent = grown[pick % grown.length];
        if (parent === undefined) return;
        const id = `${parent.id}.${String(parent.childIds.length)}`;
        parent.childIds.push(id);
        grown.push(pamNode({ id, parentId: parent.id, role, name: 'New' }));
        expect(fingerprints(grown).slice(0, nodes.length)).toEqual(fingerprints(nodes));
      }),
    );
  });

  it('survive wrapping an element in a layout container when it has an id or a name', () => {
    fc.assert(
      fc.property(trees, fc.nat(), (nodes, pick) => {
        const index = 1 + (pick % (nodes.length - 1));
        const target = nodes[index];
        if (target === undefined || (target.resourceId === null && target.name === null)) return;
        const wrapped = { ...target, id: `${target.id}.w`, parentId: target.id };
        const wrapper = pamNode({
          id: target.id,
          parentId: target.parentId,
          role: 'container',
          name: null,
          resourceId: null,
          interactive: false,
          childIds: [wrapped.id],
        });
        const byId = new Map([
          ...nodes.map((node) => [node.id, node] as const),
          [wrapper.id, wrapper],
          [wrapped.id, wrapped],
        ]);
        expect(elementKey(wrapped, byId)).toBe(elementKey(target, new Map(nodes.map((node) => [node.id, node]))));
      }),
    );
  });

  it('change with the rule, the screen, the app or the element id', () => {
    const node = pamNode({ id: '0', resourceId: 'save' });
    const base = issueFingerprint('name/interactive-missing', 'app', 'Cart', node);
    expect(issueFingerprint('target/size', 'app', 'Cart', node)).not.toBe(base);
    expect(issueFingerprint('name/interactive-missing', 'app', 'Checkout', node)).not.toBe(base);
    expect(issueFingerprint('name/interactive-missing', 'other.app', 'Cart', node)).not.toBe(base);
    expect(issueFingerprint('name/interactive-missing', 'app', 'Cart', { ...node, resourceId: 'remove' })).not.toBe(
      base,
    );
  });

  it('tell unnamed elements apart by where they sit, ignoring layout wrappers', () => {
    const root = pamNode({ id: '0', role: 'container', name: null, interactive: false, childIds: ['0.0', '0.1'] });
    const first = pamNode({ id: '0.0', parentId: '0', name: null });
    const second = pamNode({ id: '0.1', parentId: '0', name: null });
    const byId = new Map([root, first, second].map((node) => [node.id, node]));
    expect(elementKey(first, byId)).toBe('path:button[0]');
    expect(elementKey(second, byId)).toBe('path:button[1]');
  });
});

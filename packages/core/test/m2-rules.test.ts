import { describe, expect, it } from 'vitest';
import { noHeadings, roleInLabel } from '../src/index.js';
import type { PamNode } from '../src/index.js';
import { pamNode, screenOf } from './helpers.js';

const device = {} as never;
const run = (rule: typeof roleInLabel, nodes: PamNode[]) =>
  rule.check({ screen: screenOf(nodes), device, raster: null }).map((finding) => finding.node.id);

describe('name/role-in-label', () => {
  it('flags a name that repeats its role as a whole word', () => {
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'button', name: 'Delete button' })])).toEqual(['0.0']);
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'switch', name: 'Dark mode toggle' })])).toEqual(['0.0']);
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'image', name: 'Image of a mug' })])).toEqual(['0.0']);
  });

  it('leaves alone good names, words that only contain the role, other roles, and the bare role word', () => {
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'button', name: 'Delete' })])).toEqual([]);
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'button', name: 'Buttonhole guide' })])).toEqual([]);
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'text', name: 'Press the blue button' })])).toEqual([]);
    expect(run(roleInLabel, [pamNode({ id: '0.0', role: 'button', name: 'Button' })])).toEqual([]);
    expect(
      run(roleInLabel, [pamNode({ id: '0.0', role: 'button', name: 'Delete button', exposedToAssistiveTech: false })]),
    ).toEqual([]);
  });
});

describe('structure/no-headings', () => {
  const texts = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      pamNode({ id: `0.${String(index + 1)}`, role: 'text', text: `Line ${String(index)}` }),
    );
  const root = pamNode({ id: '0', role: 'container' });

  it('reports a long screen with no heading once, on the window root', () => {
    expect(run(noHeadings, [root, ...texts(8)])).toEqual(['0']);
  });

  it('stays silent with a heading, or on a short screen', () => {
    expect(
      run(noHeadings, [root, pamNode({ id: '0.0', role: 'heading', name: 'Help', text: 'Help' }), ...texts(12)]),
    ).toEqual([]);
    expect(run(noHeadings, [root, ...texts(7)])).toEqual([]);
  });
});

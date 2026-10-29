import { describe, expect, it } from 'vitest';
import { announce, transcript } from '../src/index.js';
import { pamNode, screenOf } from './helpers.js';

describe('announce', () => {
  it.each([
    [{ role: 'button' as const, name: 'Remove item' }, 'Remove item, Button'],
    [{ role: 'button' as const, name: null }, 'Unlabelled, Button'],
    [{ role: 'container' as const, name: null }, 'Unlabelled'],
    [{ role: 'heading' as const, name: 'Settings', interactive: false }, 'Settings, Heading'],
    [{ role: 'textfield' as const, name: 'Email' }, 'Email, Edit box'],
    [{ role: 'checkbox' as const, name: 'Gift wrap', checked: false }, 'Gift wrap, Checkbox, not checked'],
    [{ role: 'switch' as const, name: 'Notifications', checked: true }, 'Notifications, Switch, On'],
    [{ role: 'switch' as const, name: null, stateDescription: 'Off' }, 'Unlabelled, Switch, Off'],
    [{ role: 'button' as const, name: 'Use saved card', enabled: false }, 'Use saved card, Button, disabled'],
    [{ role: 'text' as const, name: 'Free shipping', interactive: false }, 'Free shipping'],
  ])('%j → "%s"', (overrides, spoken) => {
    expect(announce(pamNode({ id: '0', ...overrides }))).toBe(spoken);
  });
});

describe('transcript', () => {
  it('reads the focus stops in tree order, and reads text inside a control as part of it', () => {
    const screen = screenOf([
      pamNode({
        id: '0',
        role: 'container',
        name: null,
        interactive: false,
        focusable: false,
        childIds: ['0.0', '0.1', '0.2'],
      }),
      pamNode({ id: '0.0', parentId: '0', role: 'heading', name: 'Your cart', interactive: false, focusable: false }),
      pamNode({ id: '0.1', parentId: '0', name: 'Checkout · €36.00', childIds: ['0.1.0'] }),
      pamNode({
        id: '0.1.0',
        parentId: '0.1',
        role: 'text',
        name: 'Checkout · €36.00',
        interactive: false,
        focusable: false,
      }),
      pamNode({ id: '0.2', parentId: '0', name: null }),
    ]);
    expect(transcript(screen)).toEqual([
      { nodeId: '0.0', text: 'Your cart, Heading' },
      { nodeId: '0.1', text: 'Checkout · €36.00, Button' },
      { nodeId: '0.2', text: 'Unlabelled, Button' },
    ]);
  });

  it('skips what TalkBack never reaches: hidden, off-screen, web content, other windows, silent containers', () => {
    const screen = screenOf([
      pamNode({ id: '0', name: 'Hidden', exposedToAssistiveTech: false }),
      pamNode({ id: '1', name: 'Off screen', visible: false }),
      pamNode({ id: '2', name: 'Web', inWebView: true }),
      pamNode({ id: '3', name: 'Behind the dialog', window: 1 }),
      pamNode({ id: '4', role: 'container', name: null, interactive: false, focusable: false }),
    ]);
    expect(transcript(screen)).toEqual([]);
  });
});

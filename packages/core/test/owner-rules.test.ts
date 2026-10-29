import { describe, it } from 'vitest';

// Owner tasks for Florent (docs/plans/owner-tasks-rules.md): turn each todo into a real
// test, then write the rule until it passes.

describe('target/size platform tier (info)', () => {
  it.todo('reports a 40 dp target as info: it passes WCAG 2.5.8 but misses Android’s 48 dp guidance');
  it.todo('accepts a 48 dp target, and leaves targets under 24 dp to target/size');
  it.todo('does not flag a Compose control whose touch area is already enlarged to 48 dp');
});

describe('name/generic (warning)', () => {
  it.todo('flags a name that only repeats the role, such as "Button" on a button');
  it.todo('flags resource-like names: ic_close, img_1234.png, button1');
  it.todo('accepts short real names such as "Close", "Back" and "Add to wishlist"');
  it.todo('ignores unnamed controls, which name/interactive-missing reports');
});

describe('contrast/non-text (warning)', () => {
  it.todo('flags a pale icon button under 3:1 against its background');
  it.todo('accepts a dark icon at 3:1 or more');
  it.todo('stays silent on busy backgrounds and on disabled controls');
});

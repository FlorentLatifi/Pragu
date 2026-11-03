import { describe, it } from 'vitest';

// Owner task (docs/plans/owner-tasks-m2.md, ADR-012): Florent turns these into real tests.
describe('Pragu score (owner task)', () => {
  it.todo('reproduces the ADR-012 worked example: rn-shop cart 57.45, summary 89.89, Compose settings 75.62');
  it.todo('is 100 exactly when no weighted finding exists, and never leaves 0–100');
  it.todo('drops strictly when a weighted finding is added, and does not depend on issue order');
  it.todo('leaves out a rule whose input is missing on the screen, instead of counting it as passed');
  it.todo('uses default severities, so a config override does not change the score');
});

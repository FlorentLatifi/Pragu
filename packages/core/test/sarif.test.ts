import { describe, it } from 'vitest';

// Owner task for Florent (docs/plans/owner-task-sarif.md): turn each todo into a real test,
// then write packages/core/src/sarif.ts until they pass.
describe('toSarif (SARIF 2.1.0)', () => {
  it.todo('describes Pragu as the tool, with its version and repository');
  it.todo('lists every rule that ran as a reportingDescriptor with title, who is affected, fixes and WCAG tags');
  it.todo('maps severity to level: error → error, warning → warning, info → note');
  it.todo('puts the issue fingerprint in partialFingerprints["pragu/v1"]');
  it.todo('sets baselineState to new or unchanged when the scan used a baseline, and leaves it out otherwise');
  it.todo('gives every result a location GitHub code scanning accepts');
  it.todo('is deterministic: the same result always gives the same SARIF (golden file)');
  it.todo('validates against the official SARIF 2.1.0 JSON Schema');
});

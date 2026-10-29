# Owner task: the SARIF writer

**Who:** Florent writes it; Claude reviews. M1 plan, owner-implements task 4. It is a mapping exercise against a spec, and the GitHub Action (M2) needs it to show findings as code scanning alerts.

## What to build

`toSarif(result: ScanResult): SarifLog` in a new `packages/core/src/sarif.ts`, plus `--format sarif` on `pragu scan` writing `pragu-results.sarif` next to the JSON. Pure function, no dependencies, deterministic output (sort everything you emit).

## Read first

- SARIF 2.1.0 (OASIS): sections 3.13 `run`, 3.19 `toolComponent`, 3.27 `result`, 3.28 `location`, 3.49 `reportingDescriptor`.
- GitHub's SARIF support page: the subset code scanning reads, and its limits.
- `packages/core/src/model.ts` (`ScanResult`, `Issue`) and `packages/core/src/rules/` (rule metadata).

## Mapping to decide and test

| Pragu | SARIF | Notes |
|---|---|---|
| Tool, version | `runs[0].tool.driver.name/version/informationUri` | `informationUri`: the repository |
| Each rule that ran (`summary.rulesRun`) | `driver.rules[]` (`reportingDescriptor`) | `id`, `shortDescription` (title), `fullDescription` (who is affected), `help` (the fixes), `properties.tags` (`accessibility`, `wcag-1.4.3`, …) |
| `issue.severity` | `result.level` | error → `error`, warning → `warning`, info → `note` |
| `issue.message` | `result.message.text` | |
| `issue.fingerprint` | `result.partialFingerprints["pragu/v1"]` | lets GitHub track an alert across runs |
| `issue.inBaseline` | `result.baselineState` | `unchanged` when in the baseline, else `new` (only when the scan used a baseline) |
| Screen and element | `result.locations[]` | **Open question:** code scanning wants a file location, but a mobile screen has no source file until source mapping (M4). Find out what GitHub accepts (a `logicalLocation`? the app manifest? the report file?) and propose one in the review. |
| `issue.evidence`, confidence, WCAG, EN 301 549 | `result.properties` | |

## Done when

- The `it.todo` entries in `packages/core/test/sarif.test.ts` are real tests and pass, including a golden file of the SARIF for a fixed result.
- The output validates against the official SARIF 2.1.0 JSON Schema in a test (ajv is already a dev dependency).
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass; core coverage stays at 90% or more.
- You can explain in the walkthrough why each mapping was chosen, and what GitHub does with `partialFingerprints`.

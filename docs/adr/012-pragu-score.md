# ADR-012: The Pragu score

- Status: Accepted (2026-11-03, decided on Florent's instruction; see `docs/decisions.md`). Implement in M2.
- Date: 2026-11-03

## Context

The brief asks for a 0–100 "Pragu score": deterministic, documented, weighted by severity, confidence and impact, like Lighthouse. It appears in the report and in the PR comment ("Score 86 → 81"). It must never imply compliance, must not reward gaming, and must stay comparable between the two scans of one pull request.

## Decision

Per screen, for each rule that ran and had its input (see below):

- `f` = the number of distinct elements the rule reports. Issues in the baseline count (they are real barriers); issues the config ignores do not (they were judged not to be barriers).
- Weight `w` = severity weight × confidence weight, from the rule's **default** metadata, never from config overrides: error 10, warning 3, info 0; high 1.0, medium 0.7, low 0.4. Info never moves the score. Compute in tenths (100, 21, …) so no floating-point noise reaches the result.
- Penalty share `s(f)` = 0 when `f` = 0, otherwise `1 − 0.5^(f+1)`: the first barrier takes 75% of the rule's weight, each further one half of what is left (87.5%, 93.75%, …).
- **Screen score** = `100 × (1 − Σ w·s(f) / Σ w)`.
- **Scan score** = the mean of the screen scores, floored to an integer at the end. Never rounded up.

A rule whose input is missing on a screen (no screenshot because of `FLAG_SECURE`, no 200% capture without `--check-font-scale`) is left out of both sums: "not checked" must not count as "passed". Rules declare their inputs in metadata (`requires: ['screenshot' | 'largeText']`). A rule with nothing to judge (no text fields on the screen) counts as passed.

The result carries `scoreVersion: 1`. Two scores are compared, and a delta shown, only when both have the same `scoreVersion` and the same rules ran.

Wording everywhere: "Pragu score 72/100 (automated checks)", and the report and docs say that 100 does not mean accessible.

## Why this shape

- The first barrier of a kind matters most, as when a Lighthouse audit fails; more barriers still count, but saturate.
- No per-rule denominators: adding passing elements cannot inflate the score, and rules do not have to report what they checked.
- Default weights keep scores comparable across projects: lowering a rule's severity in config changes what fails the build, not the score.

## Worked example (bench recordings, 2026-11-03, all nine rules)

| Screen | Barriers | Screen score |
|---|---|---|
| rn-shop cart | 4 errors, 1 warning | 57.45 |
| rn-shop summary | 1 error | 89.89 |
| Compose settings | 3 errors (2 rules), 2 warnings | 75.62 |

The five rn-shop screens together would score 72.

## Properties to prove (fast-check)

Bounded to 0–100; 100 exactly when no weighted finding exists; strictly lower when a weighted finding is added; independent of issue order; deterministic.

## Alternatives

- Pass rate per rule: needs every rule to report what it checked, and rewards screens with many passing elements.
- Pass or fail per rule, like Lighthouse: fixing four of five contrast failures would not move the score.
- No score: the brief asks for one, and teams need a trend line in pull requests.

## Revisit

When the real bench (ADR-015) shows the score disagreeing with expert rankings of screens. Changes ship as `scoreVersion` 2, never silently.

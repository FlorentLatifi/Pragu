# Owner tasks: M2

**Who:** Florent writes them; Claude reviews. M2 plan, owner-implements. The third candidate in the plan, `pragu comment`, was built by Claude on 2026-11-03 while doing the GitHub integration; review it instead (`packages/cli/src/comment.ts` and its golden test) and be ready to explain it.

## 1. Wilson intervals in the bench

**What:** next to each precision and recall, a Wilson 95% score interval, so a reader sees that 2 out of 2 is not the same evidence as 40 out of 40 (ADR-015, D-08).

- Add `wilson(successes, trials, z = 1.96): { low: number; high: number } | null` to `bench/src/metrics.ts`. It is null when `trials` is 0. Look up the formula yourself (Wilson, 1927) and write it down in the doc comment.
- Precision uses `tp` out of `tp + fp`, recall uses `tp` out of `tp + fn`. Add `precisionInterval` and `recallInterval` to `RuleResult`, truncated like every other published number (never rounded up), and show them in `docs/bench/results.md` (`bench/src/report.ts`).
- `bench/results.json` changes shape, so run `pnpm bench:update` and commit the new table on purpose.
- The tests to make real are the `it.todo` entries in `bench/test/owner-wilson.test.ts`.

You should be able to say why the interval for 2/2 is so wide, and why Wilson rather than the "normal approximation" interval.

## 2. The Pragu score

**What:** the 0–100 score of ADR-012. The formula is decided; implementing and proving it is yours.

- `packages/core/src/score.ts`: `scoreScreen(screen, issues, rules)` and `scoreScan(result)`, using each rule's **default** severity and confidence, weights in tenths (integers), `s(f) = 1 − 0.5^(f+1)` for `f > 0`, floor only at the end.
- Rules declare their inputs: add `requires?: ('screenshot' | 'largeText')[]` to `RuleMeta`; `contrast/text` needs the screenshot and `text/scaling-truncation` the 200% capture. A rule whose input is missing on a screen is left out of that screen's score.
- `scoreVersion: 1` and `score` in the result (a schema bump), the score in the report's summary, and the change in `pragu comment` when the main branch's result is comparable.
- The worked example in ADR-012 (rn-shop cart 57.45, summary 89.89, Compose settings 75.62) is a test: the numbers must come out exactly.
- Property tests with fast-check: bounded 0–100; 100 exactly when there is no weighted finding; strictly lower when one is added; independent of issue order. They are the `it.todo` entries in `packages/core/test/owner-score.test.ts`.

You should be able to defend each choice in ADR-012 against "why not just count the issues?".

## Done when

The `it.todo` entries are real tests and pass; `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm bench` pass; core coverage stays at 90% or more; and you can explain the two questions above in the walkthrough.

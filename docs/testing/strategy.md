# Test and evaluation strategy

Two questions, kept apart: **does the code do what we wrote?** (tests) and **are the rules right about real apps?** (evaluation, Pragu Bench). Never fabricate or round up a number.

## Tests

| Layer | What | Where | Gate |
|---|---|---|---|
| Unit: rules | Every rule on synthetic PAM trees and pixel buffers, for what it flags and what it must not flag (twins, spacing exception, busy backgrounds) | `packages/core/test` | Coverage ≥ 90% lines, functions and statements, ≥ 85% branches on `packages/core` |
| Unit: Android adapter | Role mapping, TalkBack-style naming, normalisation, capture validation | `packages/core/test/android.test.ts` | Same |
| Contract | The agent's JSON fields equal the core's `AndroidRawNode` fields | `agents/android/.../SnapshotTest.kt` | CI |
| Golden | Report HTML from fixed data compared to a committed file. Later: SARIF, PR comment, transcript | `packages/report/test/__snapshots__` | CI (update deliberately with `vitest -u`) |
| Pipeline | `pragu scan --from-capture` from a synthetic capture to JSON, HTML and exit code | `packages/cli/test` | CI |
| Agent JVM | Framing, request handling, peer check | `agents/android/agent/src/test` | CI |
| Device end-to-end | Every bench screen recorded live on a fresh API 36 emulator (normal and 200% text); the bench must reproduce the published results exactly | Every push and PR: `.github/workflows/e2e.yml` (`reactivecircus/android-emulator-runner`, software rendering, cached snapshot) | Done (M1) |
| Property-based | Fingerprint invariance and sensitivity; scoring monotonicity (fast-check) | M1 | CI |
| Report accessibility | axe-core with Playwright, keyboard walk-through, screen-reader check before each release | M1–M2 | CI and release checklist |

## Evaluation: Pragu Bench

- **Ground truth:** two fixture apps, React Native (`rn-shop`) and Jetpack Compose (`android-compose`), because the toolkits expose accessibility differently (ADR-009). Each fixture screen has `expected.json`, listing barriers (must be reported) and correct twins (must not be reported), keyed by `testID`/resource id. Later: real open-source apps (e.g. from F-Droid) with screens labelled by hand.
- **Matching:** a reported issue is a true positive when its rule and element match a barrier. A false positive is any other reported issue: on a twin, or not listed at all. A false negative is a barrier that was not reported. A true negative is a twin that was not flagged.
- **Metrics per rule:** precision, recall, F1 and MCC (Matthews correlation coefficient, which stays meaningful when classes are unbalanced), with the counts behind each number.
- **Recordings:** real captures of every labelled screen are committed (`bench/recordings/`), so CI re-scores every rule on every PR without an emulator (`pnpm bench`). They are re-recorded on an emulator when a fixture changes (`pnpm bench:record`).
- **Gates:** CI fails whenever the bench differs from the published `bench/results.json`: a drop in precision or recall is a regression, and any other change must be accepted on purpose (`pnpm bench:update`). An "error" rule ships only with precision ≥ 0.90; that becomes a release gate at the end of M1. Results are published in [docs/bench/results.md](../bench/results.md), like JavaSmell's MCC table. See [bench/README.md](../../bench/README.md).

## Performance budgets

Measured in M1 (2026-10-29), then budgeted with margin:

| What | Measured | Budget | Enforced by |
|---|---|---|---|
| One scan on a CI emulator (capture, analysis, report) | 2.1–7.6 s; 16 scans in 64.6 s | 20 s per scan | `e2e.yml`, `bench record --budget-seconds 20` |
| Report size | 231 KB for one screen (screenshot 147 KB embedded, fonts 60 KB); about 3 MB projected for 20 screens | 300 KB per one-screen report | `packages/report/test/report.test.ts` (real recording) |
| CLI cold start (`pragu --version`) | about 150 ms | 500 ms | Measured only: timing tests on shared runners would raise false alarms |
| Re-analysis from a saved capture | about 260 ms | none yet | Measured only |

The whole e2e job takes about 13 minutes: fixture builds 6.5 minutes, recording 2.4 minutes including boot.

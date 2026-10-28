# Pragu status

Last updated: 2026-10-28, M1 session 3. **M0 approved. M1 in progress:** Pragu Bench covers two fixtures (React Native and Jetpack Compose); agent hardening mostly done; the first M1 rule, `input/missing-label`, has landed.

## Decisions made

- Repo `FlorentLatifi/Pragu`; free options only; Apache-2.0 with DCO; pnpm 12, TypeScript 6.0.3, Node >= 22.13 (ADR-002, ADR-005).
- Capture via Instrumentation + UiAutomation; the agent talks only through adb (ADR-001, ADR-006).
- Label suggestions (M4): local by default, own API key only as an opt-in. No Mac, so iOS waits.
- M1 plan approved (`docs/plans/m1.md`).
- `target/size` is a warning until Pragu can see React Native's `hitSlop` (M4), then returns to error (ADR-007, Florent, 2026-10-28).
- The agent reports every window; rules judge only the app's topmost window, skip covered elements and leave WebView content to web tools (ADR-008).
- Compose is read the way TalkBack reads it: a role on a child is not a control of its own, text size is bounded by the element's height, and `target/size` stays silent where two Compose touch areas meet (ADR-009).
- Protocol 3 captures `labeledBy`. `input/missing-label` reports fields with no label at all. Placeholder-only labels wait for `input/placeholder-label`, which needs typing during a crawl (ADR-010).
- Commits carry no AI attribution lines (Florent rewrote `main` to remove them).

## Decisions needed (Florent)

1. **Report design direction:** A, B, C or a mix (`docs/design/directions.html`).

## Done

### M0 (approved)

Walking skeleton on the emulator, CI, docs (PRD, technical design, ADR-001 to 006, threat model, test strategy), design directions. Details in git history.

### M1 so far

- **Pragu Bench v1** (`bench/`): deep-linked fixture screens with labelled barriers and correct twins; real recordings committed; precision, recall, F1 and MCC per rule; CI re-scores every rule on every PR without an emulator and fails when results differ from `bench/results.json`.
- **Agent hardening:** idle timeout (5 minutes); every window captured (ADR-008), with dialogs, the keyboard and WebViews verified on the emulator; `labeledBy` captured (protocol 3).
- **`target/size` demoted to warning** (ADR-007).
- **Jetpack Compose fixture** (`fixtures/android-compose`, ADR-009): its first scan gave 12 issues where 5 were real. Three general fixes followed:
  - role children are no longer controls;
  - unknown text size is bounded by the element's height;
  - meeting touch areas are left alone.
  Held presses on the emulator settled the labels. The 20 dp icons Compose enlarges are twins, while touching 16 dp stars are real barriers that Pragu misses. The bench publishes them as a known blind spot. CI builds the fixture.
- **Report:** every finding shows the React Native, Compose and Android Views fix (it showed only React Native's before).
- **`input/missing-label`** (ADR-010): flags text fields with no label and names the visible text that should be connected. Seeds and twins in both fixtures, including an `aria-labelledby` twin that proves the `labeledBy` capture.
- Checks: 141 TypeScript tests, 26 JVM tests, lint, typecheck, bench gate.

## Bench results (6 screens: rn-shop, android-compose)

| Rule | Severity | TP | FP | FN | TN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| `name/interactive-missing` | error | 8 | 0 | 0 | 13 | 1.00 | 1.00 |
| `input/missing-label` | error | 2 | 0 | 0 | 4 | 1.00 | 1.00 |
| `contrast/text` | error | 6 | 0 | 0 | 11 | 1.00 | 1.00 |
| `target/size` | warning | 3 | 1 | 3 | 11 | 0.75 | 0.50 |

All error rules meet the 0.90 bar. `target/size` keeps its known misses (React Native `hitSlop`, crowded Compose targets). Small sample: early signals, not final quality figures. Full page: `docs/bench/results.md`.

## Next

1. Next M1 rules, each with fixtures and bench labels: `state/not-exposed` (already labelled in both fixtures), `name/image-missing`, `focus/unreachable`, `text/scaling-truncation`.
2. Agent hardening, last piece: instrumented tests of the capturer on an emulator (lands with the CI emulator job, work package 9).
3. Report v1 once the design direction is chosen.
4. Owner-implements for Florent: the `target/size` 48 dp platform tier (info for now, per ADR-007).

## Notes and risks

- `main` was rewritten on GitHub on 2026-10-28 (same content, new hashes). A clone made before then has no merge base: replay local work with `git rebase --onto origin/main <old tip>`, never force-push.
- The emulator died once while idle Gradle and Kotlin daemons held about 4 GB. Stop them after fixture builds.
- Disk: about 15 GB free on `C:`.
- Agent lint warnings to clear: compile and target SDK 37 available; `dataExtractionRules`; app icon.
- Dependabot PR #1 (TypeScript 7, `@types/node` 26) is ruled out by ADR-002; Florent can close it.
- For SECURITY.md to work, Florent enables private vulnerability reporting in the repo settings.
- The home network drops DNS lookups under load; build scripts cache lookups per JVM.
- The Android CLI collects metrics by default: always `--no-metrics`.
- Local toolchain: JDK 17 in `C:\dev\tools\jdk-17` (fixture builds); Android SDK in `%LOCALAPPDATA%\Android\Sdk`; emulator `medium_phone`.

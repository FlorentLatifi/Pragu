# Pragu status

Last updated: 2026-10-28, M1 session 3. **M0 approved. M1 in progress:** Pragu Bench covers two fixtures (React Native and Jetpack Compose); agent hardening mostly done; all five planned M1 error rules have landed (`input/missing-label`, `state/not-exposed`, `name/image-missing`, `focus/unreachable`, `text/scaling-truncation`).

## Decisions made

- Repo `FlorentLatifi/Pragu`; free options only; Apache-2.0 with DCO; pnpm 12, TypeScript 6.0.3, Node >= 22.18 for TypeScript config loading (ADR-002, ADR-005).
- Capture via Instrumentation + UiAutomation; the agent talks only through adb (ADR-001, ADR-006).
- Label suggestions (M4): local by default, own API key only as an opt-in. No Mac, so iOS waits.
- M1 plan approved (`docs/plans/m1.md`).
- `target/size` is a warning until Pragu can see React Native's `hitSlop` (M4), then returns to error (ADR-007, Florent, 2026-10-28).
- The agent reports every window; rules judge only the app's topmost window, skip covered elements and leave WebView content to web tools (ADR-008).
- Compose is read the way TalkBack reads it: a role on a child is not a control of its own, text size is bounded by the element's height, and `target/size` stays silent where two Compose touch areas meet (ADR-009).
- Protocol 3 captures `labeledBy`. `input/missing-label` reports fields with no label at all. Placeholder-only labels wait for `input/placeholder-label`, which needs typing during a crawl (ADR-010).
- `state/not-exposed` reports controls whose role promises a state they do not expose. Home-made toggles with no role need a tap to see and wait for the crawler (M3).
- `text/scaling-truncation` runs only with `--check-font-scale`, which changes and always restores the device's font scale (Florent chose opt-in, ADR-011). It reports the ellipsis only; boxed text is a known miss.
- Report design: direction B (Signal: Atkinson Hyperlegible, black-on-yellow plates) with A's measurement labels on callouts (Florent, 2026-10-29).
- Commits carry no AI attribution lines (Florent rewrote `main` to remove them).

## Decisions needed (Florent)

None open.

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
- **`state/not-exposed`**: flags a checkbox, switch or radio button that never says whether it is checked or on (a role with no state). Seeds and twins on the rn-shop cart and Compose checkout. The two home-made checkboxes with no role stay published as misses.
- **`name/image-missing`**: flags images TalkBack stops on but can only call "Image". Images it skips are left alone, since telling decoration from content would be a guess. Seed and twins (named, decorative) on the rn-shop product screen.
- **`focus/unreachable`**: flags controls that work by touch but are hidden from assistive technology, unless a row around them is one accessible control. Compose's `hideFromAccessibility()` looks like off-screen content and stays a published miss.
- **`text/scaling-truncation`** (ADR-011): `--check-font-scale` captures each screen again at 200% text and restores the setting (tested with 1.15 on the device). Protocol 4 reports characters an ellipsis hides. New `summary` screens in both fixtures; the bench records every screen at both sizes, and the recorder rejects blank screenshots.
- **Report v1** in the Signal direction (DESIGN.md, ADR-003 amended): Atkinson Hyperlegible embedded, black-on-yellow signs carrying each marker's number and measurement, laid out so they never overlap, contrast-tested tokens in both themes. Reviewed in the browser in light and dark, at phone and desktop widths, and with the keyboard.
- **Config, schema, doctor, baselines** (rest of work packages 7 and 8):
  - `pragu.config.ts` with `defineConfig()` and `pragu init`: rule off/severity, ignores with a required reason (counted in reports), defaults that flags override; loaded with Node's own type stripping (Node 22.18+).
  - `pragu-result.schema.json` (JSON Schema 2020-12, strict), validated in tests against every bench result; result schema 0.8.0.
  - `pragu doctor`: Node, adb, device and API level, agent, config, each with an exact fix.
  - Baselines: `pragu baseline create|update` and `--baseline`, so only new issues fail; fingerprint v1 with fast-check property tests (ADR-004).
  - SARIF: brief and test checklist ready for Florent's owner task (`docs/plans/owner-task-sarif.md`).
- Checks: 239 TypeScript tests (plus 8 SARIF todos), 26 JVM tests, lint, typecheck, bench gate.

## Bench results (8 screens: rn-shop, android-compose)

| Rule | Severity | TP | FP | FN | TN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| `name/interactive-missing` | error | 8 | 0 | 0 | 16 | 1.00 | 1.00 |
| `name/image-missing` | error | 1 | 0 | 0 | 2 | 1.00 | 1.00 |
| `input/missing-label` | error | 2 | 0 | 0 | 4 | 1.00 | 1.00 |
| `state/not-exposed` | error | 2 | 0 | 2 | 5 | 1.00 | 0.50 |
| `focus/unreachable` | error | 1 | 0 | 1 | 3 | 1.00 | 0.50 |
| `text/scaling-truncation` | error | 2 | 0 | 2 | 6 | 1.00 | 0.50 |
| `contrast/text` | error | 6 | 0 | 0 | 11 | 1.00 | 1.00 |
| `target/size` | warning | 3 | 1 | 3 | 11 | 0.75 | 0.50 |

All error rules meet the 0.90 bar. Known misses stay published: home-made checkboxes with no role (`state/not-exposed`), Compose `hideFromAccessibility()` (`focus/unreachable`), text cut by fixed-height boxes (`text/scaling-truncation`), React Native `hitSlop` and crowded Compose targets (`target/size`). Small sample: early signals, not final quality figures. Full page: `docs/bench/results.md`.

## Next

1. Rest of M1: the CI emulator job and budgets (work package 9); warning and info rules (work package 4, some are owner tasks); the screen-reader transcript (work package 5).
2. Owner tasks for Florent: SARIF writer (brief ready), `target/size` 48 dp platform tier, `name/generic`, `contrast/non-text`.
3. Agent hardening, last piece: instrumented tests of the capturer on an emulator (lands with the CI emulator job, work package 9).

## Notes and risks

- `main` was rewritten on GitHub on 2026-10-28 (same content, new hashes). A clone made before then has no merge base: replay local work with `git rebase --onto origin/main <old tip>`, never force-push.
- The emulator died once while idle Gradle and Kotlin daemons held about 4 GB. Stop them after fixture builds. After a forced restart its graphics failed (black screenshots, apps dying in their render threads); a cold boot (`-no-snapshot-load`) fixed it, and it needs a few minutes before it is responsive.
- Disk: about 15 GB free on `C:`.
- Agent lint warnings to clear: compile and target SDK 37 available; `dataExtractionRules`; app icon.
- Dependabot PR #1 (TypeScript 7, `@types/node` 26) is ruled out by ADR-002; Florent can close it.
- For SECURITY.md to work, Florent enables private vulnerability reporting in the repo settings.
- The home network drops DNS lookups under load; build scripts cache lookups per JVM.
- The Android CLI collects metrics by default: always `--no-metrics`.
- Local toolchain: JDK 17 in `C:\dev\tools\jdk-17` (fixture builds); Android SDK in `%LOCALAPPDATA%\Android\Sdk`; emulator `medium_phone`.

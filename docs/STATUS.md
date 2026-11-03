# Pragu status

Last updated: 2026-11-03, M1 session 5. **M0 approved. M1 in progress:** Pragu Bench covers two fixtures (React Native and Jetpack Compose); agent hardening mostly done; all five planned M1 error rules have landed (`input/missing-label`, `state/not-exposed`, `name/image-missing`, `focus/unreachable`, `text/scaling-truncation`).

## Decisions made

The full register is [docs/decisions.md](decisions.md) (2026-11-03, 45 decisions across product, rules, evaluation, architecture, platforms, releases, GitHub, security, docs and later milestones), with ADR-012 to ADR-016. The list below is the history before it.


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

Section L of [docs/decisions.md](decisions.md) has each one with a recommendation. The most urgent:

- Reserve the `@pragu` npm organisation (F-1); turn on private vulnerability reporting (F-6).
- Merge the three green Dependabot PRs once each release is a week old (F-10).
- **`--redact` (D-33) needs a wider scope.** Filling text in the screenshots alone would leave the same text in the screen-reader transcript, the issue messages (contrast quotes the text), the result JSON (every node's name and text) and `capture/` (raw trees and full screenshots). Proposal: `--redact` writes a report meant for sharing: text areas filled in the screenshots, transcript lines reduced to role and state ("Button", "Text"), quoted text removed from messages, node text and names replaced in the JSON, and no `capture/` folder; the result says it is redacted. The GitHub Action uploads only that. Needs Florent's yes, since it changes the result schema and the action's artifact.

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
  - `pragu-result.schema.json` (JSON Schema 2020-12, strict), validated in tests against every bench result; result schema 0.9.0 (0.9.0 added the fixed issues to the baseline summary).
  - `pragu doctor`: Node, adb, device and API level, agent, config, each with an exact fix.
  - Baselines: `pragu baseline create|update` and `--baseline`, so only new issues fail; fingerprint v1 with fast-check property tests (ADR-004).
  - SARIF: brief and test checklist ready for Florent's owner task (`docs/plans/owner-task-sarif.md`).
- **CI on a real emulator** (work package 9): every push and PR records all bench screens live on a fresh API 36 emulator (`.github/workflows/e2e.yml`), and the bench must reproduce the published results exactly. This is the end-to-end test of the agent and capturer. Green on the first run. Budgets set from measurements: 20 s per scan (slowest measured 7.6 s), 300 KB per one-screen report; CLI cold start about 150 ms (docs/testing/strategy.md). Its first runs found two real problems, both fixed: an agent signed on another machine could not be updated in place (the CLI now reinstalls it; never the user's app), and a stopped agent showed as "unexpected error" (now a Pragu error with next steps; the recorder retries once visibly and CI keeps the device log).
- **`name/duplicate`** (warning): several controls with the same name, like rows whose delete buttons are all "Remove". No false alarms on the eight existing screens; seeds and twins in Compose settings. The other M1 warning rules are Florent's owner tasks (briefs ready); `focus/order`, `name/role-in-label` and `structure/no-headings` moved to M2 per the plan.
- **Screen-reader transcript** (work package 5): each report screen shows what TalkBack would say swiping through it, in order ("Gift wrap this order, Checkbox" where the state is missing; "Unlabelled" where a control is silent), labelled as an approximation, with finding numbers on the lines they affect. Checked against the fixtures by reading. A comparison with real TalkBack 16 on the emulator (2026-10-29) did not get past the first stop: TalkBack's focus outline can be found in screenshots and matched to the recorded element, but neither `adb shell input` swipes (60–450 ms), chained motion events nor Alt+Right moved its focus, and TalkBack logs no speech. Order and wording are therefore still unverified; TalkBack was turned off and the original settings restored.
- **Report views** (rest of work package 6, ADR-003 second amendment):
  - a rule index, worst and most frequent first, linking to the numbered cards;
  - filters by severity and, with a baseline, "New only". Filtered cards and outlines hide and their signs turn grey and dashed; without scripts everything shows;
  - a baseline diff: "New" and "In baseline" tags, and a "Fixed since the baseline" list (result schema 0.9.0).
  - `pnpm report:a11y` runs axe-core (WCAG 2.2 A/AA) in Chrome on real reports in CI: 20 runs over light and dark, phone and desktop, filtered and not. Its first run found three real problems in the report; the numbered signs are now the links and the outlines only drawings.
  - New dev dependencies: `axe-core` 4.14.0 and `playwright-core` 1.64.1 (uses the browser on the runner; full Playwright would download one each run).
- Checks: 267 TypeScript tests (plus 18 owner-task todos), 26 JVM tests, lint, typecheck, bench gate, report axe check.

### M2 so far

- **Decision register** (`docs/decisions.md`) and ADR-012 to ADR-016; M2 plan and D-16 approved by Florent (2026-11-03).
- **Several screens per scan** (work package 1, first part; D-02): `screens: [{ name, deepLink?, waitFor? }]` in `pragu.config.ts`. One scan opens each screen on a fresh start, in one agent session, and waits for the `waitFor` element so a splash screen is never checked under the screen's name. `--screen <name>` picks one. With `--check-font-scale` the scale changes once and every screen is opened again at 200%. Captures and a `capture/screens.json` stay next to the report, so `--from-capture` re-runs the whole scan without a device.
  - On the emulator (2026-11-03), all five rn-shop screens in one scan took 42 s on an emulator still settling after boot (load average 8) and found the 18 issues the bench finds on those screens; with the 200% pass, 93 s and 19 issues, the 19th the seeded truncation; the font scale was back at 1.0 afterwards. A bad deep link and a missing `waitFor` element each stop the scan with a fix.
  - The five-screen report is 777 KB, about 155 KB per screen: screenshot downscaling (D-20, work package 2) is next.
- **The rest of work package 1:** `pragu rules [--explain <id>]` (from rule metadata); `pragu report <pragu-result.json>` (re-renders from a result and its kept screenshots; refuses another schema version and says how to re-analyse); `--verbose` (each adb command and agent request with its duration, checked on the emulator); the report lists the screens with their counts when a scan has several, and counts issues per WCAG principle. The axe check now includes a three-screen report (24 runs, passing).
- Checks: 283 TypeScript tests (plus 18 owner-task todos), lint, typecheck, bench, report axe check.
- **Work package 2 (honest edges), all but `--redact`:**
  - Screenshots are embedded at 720 px without alpha (D-20): the five-screen report went from 777 KB to 618 KB, so 20 screens come to about 2.3 MB. pngjs compresses worse than Android, which is why the gain is smaller than the pixel count suggests.
  - A scan warns when the report folder is inside OneDrive, Dropbox, iCloud Drive or Google Drive (D-34).
  - The report says when a screen scrolls and only its visible part was checked (D-04; `PamNode.scrollable`, result schema 0.10.0). Checked on the emulator's Settings app.
  - `FLAG_SECURE` screens (D-03): Android 16 paints a secure window black instead of refusing the screenshot. When every visible text sits on pure black, Pragu checks the screen by its tree alone, skips contrast and says why; the agent (0.0.5) also sends the tree alone if a device does refuse. Checked on the emulator with the Compose fixture's new `composeshop://secure`: 4 issues, no contrast check, the note in the report.
- Checks: 292 TypeScript tests (plus 18 owner-task todos), 26 JVM tests (counted from the test reports), lint, typecheck, bench.

## Bench results (8 screens: rn-shop, android-compose)

| Rule | Severity | TP | FP | FN | TN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| `name/interactive-missing` | error | 8 | 0 | 0 | 17 | 1.00 | 1.00 |
| `name/image-missing` | error | 1 | 0 | 0 | 2 | 1.00 | 1.00 |
| `input/missing-label` | error | 2 | 0 | 0 | 4 | 1.00 | 1.00 |
| `state/not-exposed` | error | 2 | 0 | 2 | 5 | 1.00 | 0.50 |
| `focus/unreachable` | error | 1 | 0 | 1 | 3 | 1.00 | 0.50 |
| `text/scaling-truncation` | error | 2 | 0 | 2 | 6 | 1.00 | 0.50 |
| `contrast/text` | error | 6 | 0 | 0 | 11 | 1.00 | 1.00 |
| `target/size` | warning | 3 | 1 | 3 | 11 | 0.75 | 0.50 |
| `name/duplicate` | warning | 2 | 0 | 0 | 2 | 1.00 | 1.00 |

All error rules meet the 0.90 bar. Known misses stay published: home-made checkboxes with no role (`state/not-exposed`), Compose `hideFromAccessibility()` (`focus/unreachable`), text cut by fixed-height boxes (`text/scaling-truncation`), React Native `hitSlop` and crowded Compose targets (`target/size`). Small sample: early signals, not final quality figures. Full page: `docs/bench/results.md`.

## Next

1. **Florent:** the decisions in section L of `docs/decisions.md`; the M1 walkthrough and its three questions (`docs/plans/m1-walkthrough.md`).
2. **Florent:** check the transcript on a phone with TalkBack's "Display speech output" (D-14): rn-shop cart and Compose checkout, every spoken line written down.
3. **Florent's owner tasks**, briefs ready: SARIF writer (`docs/plans/owner-task-sarif.md`); `target/size` platform tier, `name/generic`, `contrast/non-text` (`docs/plans/owner-tasks-rules.md`).
4. **Claude** (the M2 plan was approved on 2026-11-03), in its order, without touching the owner tasks' files: `--redact` once its scope is agreed, then distribution (work package 6).

## Notes and risks

- `main` was rewritten on GitHub on 2026-10-28 (same content, new hashes). A clone made before then has no merge base: replay local work with `git rebase --onto origin/main <old tip>`, never force-push.
- Once, on CI, the agent stopped mid-capture on the first React Native screen and has not recurred; if it does, the e2e artifact now holds the device log.
- The local emulator's host-GPU driver crashes app render threads at random ("app died", black screenshots); it is not Pragu. Start it with `-gpu swiftshader_indirect`, as CI does.
- The emulator died once while idle Gradle and Kotlin daemons held about 4 GB. Stop them after fixture builds. After a forced restart its graphics failed (black screenshots, apps dying in their render threads); a cold boot (`-no-snapshot-load`) fixed it, and it needs a few minutes before it is responsive.
- Disk: about 15 GB free on `C:`.
- Agent lint warnings to clear: compile and target SDK 37 available; `dataExtractionRules`; app icon.
- Dependabot PR #1 (TypeScript 7, `@types/node` 26) is ruled out by ADR-002; Florent can close it.
- For SECURITY.md to work, Florent enables private vulnerability reporting in the repo settings.
- The home network drops DNS lookups under load; build scripts cache lookups per JVM.
- The Android CLI collects metrics by default: always `--no-metrics`.
- Local toolchain: JDK 17 in `C:\dev\tools\jdk-17` (fixture builds); Android SDK in `%LOCALAPPDATA%\Android\Sdk`; emulator `medium_phone`.

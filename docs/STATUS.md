# Pragu status

Last updated: 2026-10-28, M1 session 2. **M0 approved. M1 in progress:** Pragu Bench v1 done; agent hardening mostly done (windows, dialogs, keyboard, WebViews, idle timeout).

## Decisions made

- Repo `FlorentLatifi/Pragu`; free options only; Apache-2.0 with DCO; pnpm 12, TypeScript 6.0.3, Node >= 22.13 (ADR-002, ADR-005).
- Capture via Instrumentation + UiAutomation; the agent talks only through adb (ADR-001, ADR-006).
- Label suggestions (M4): local by default, own API key only as an opt-in. No Mac, so iOS waits.
- M1 plan approved (`docs/plans/m1.md`).
- `target/size` is a warning until Pragu can see React Native's `hitSlop` (M4), then returns to error (ADR-007, Florent, 2026-10-28).
- Protocol 2: the agent reports every window; rules judge only the app's topmost window, skip covered elements and leave WebView content to web tools (ADR-008).

## Decisions needed (Florent)

1. **Report design direction:** A, B, C or a mix (`docs/design/directions.html`).

## Done

### M0 (approved)

Walking skeleton on the emulator, CI, docs (PRD, technical design, ADR-001 to 006, threat model, test strategy), design directions. Details in git history.

### M1 so far

- **Pragu Bench v1** (`bench/`): 3 deep-linked rn-shop screens (cart, product, form) with labelled barriers and correct twins; real recordings committed; precision, recall, F1 and MCC per rule; CI re-scores every rule on every PR without an emulator and fails when results differ from `bench/results.json`.
- **First bench catch, fixed:** `contrast/text` flagged a disabled button's grey text, which WCAG 1.4.3 exempts. Now skipped.
- **Agent idle timeout:** the agent stops after 5 idle minutes (configurable). Verified on the emulator: with a 3 s timeout it logged "Idle for 3 s; stopping" and exited cleanly.
- **`target/size` demoted to warning** (ADR-007): the bench's `hitSlop` false positive stays published; builds no longer fail on it at the default `--fail-on error`.
- **Every window, protocol 2** (ADR-008): dialogs, popups, the keyboard and system UI are captured as windows; only the app's own windows carry trees. Rules judge the app's topmost window only, skip elements a window covers, skip contrast on partly covered text, and leave WebView content to web tools. Reports say when a dialog, the keyboard or web content limited the checks.
- **Bench dialog state:** `rnshop://cart?dialog=remove` opens a React Native `Modal`; its barriers are found and the cart's barriers behind it are not. On API 36 Android itself omits the covered window from `getWindows()` (ADR-008).
- **Keyboard verified on the emulator:** the keyboard is captured as its own window without a tree, elements under it are marked, and the report says it was open.
- Checks: 130 TypeScript tests, 24 JVM tests, lint, typecheck, bench gate.

## Bench results (4 screens, rn-shop)

| Rule | Severity | TP | FP | FN | TN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| `name/interactive-missing` | error | 5 | 0 | 0 | 9 | 1.00 | 1.00 |
| `contrast/text` | error | 5 | 0 | 0 | 8 | 1.00 | 1.00 |
| `target/size` | warning | 3 | 1 | 0 | 5 | 0.75 | 1.00 |

Both error rules meet the 0.90 bar. Small sample: early signals, not final quality figures. Full page: `docs/bench/results.md`.

## Next

1. Agent hardening, last piece: instrumented tests of the capturer on an emulator (lands with the CI emulator job, work package 9).
2. `fixtures/android-compose` for the bench, so it is not React Native only.
3. Then the M1 rules, each landing with fixtures and bench labels.
4. Owner-implements for Florent: the `target/size` 48 dp platform tier (info for now, per ADR-007).

## Notes and risks

- Disk: about 15 GB free on `C:`.
- Agent lint warnings to clear: compile and target SDK 37 available; `dataExtractionRules`; app icon.
- Dependabot PR #1 (TypeScript 7, `@types/node` 26) is ruled out by ADR-002; Florent can close it.
- For SECURITY.md to work, Florent enables private vulnerability reporting in the repo settings.
- The home network drops DNS lookups under load; build scripts cache lookups per JVM.
- The Android CLI collects metrics by default: always `--no-metrics`.
- Local toolchain: JDK 17 in `C:\dev\tools\jdk-17` (fixture builds); Android SDK in `%LOCALAPPDATA%\Android\Sdk`; emulator `medium_phone`.

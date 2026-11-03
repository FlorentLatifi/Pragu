# ADR-016: Covering more than one screen

- Status: Proposed direction (2026-11-03, on Florent's instruction; see `docs/decisions.md`). Step 1 lands in M2; the M3 navigation RFC confirms steps 2 to 4 with prototypes.
- Date: 2026-11-03

## Context

Real teams need many screens per scan: the brief wants every screen their Maestro, Detox or Appium tests visit, plus a safe crawler. Two platform facts shape the options:

- Only one `UiAutomation` connection can exist at a time (ADR-001), and UiAutomator-based tools (Maestro, Appium, Detox's device actions) hold it while they run.
- "UiAutomation suppresses accessibility services by default" (Android reference, `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`). So while such a tool runs, an accessibility service of ours would be switched off too, unless the tool opts out. Appium can, with `disableSuppressAccessibilityService`.

## Decision: four steps, cheapest working path first

1. **Declared screens (M2):** `screens` in `pragu.config.ts`, each with a name and an optional deep link. Each screen gets a fresh app start and its deep link, as the bench recorder already does. Config names are stable screen keys for fingerprints (ADR-004).
2. **End-of-flow capture (M3):** `pragu scan --flow "<command>"` runs a test command (one Maestro flow file, one Detox test), waits for it to exit and release `UiAutomation`, then captures the screen it left. Any tool that exits works. Done by hand, this is already possible today: `maestro test cart.yaml && pragu scan --no-launch --screen-name Cart`. The v0.1 docs show that recipe once it is verified on the emulator.
3. **Watch mode (M3):** an `AccessibilityService` in the same agent APK. It is enabled only for the run and always disabled afterwards, restored like the font scale (ADR-011). It streams a capture to the CLI whenever the app's screen settles, and nothing is stored on the device. It serves manual exploration and tools that leave services running. Screenshots need API 30 or newer, and Android enforces a minimum interval between them.
4. **Crawler (M3):** driven by the CLI over the existing `UiAutomation` agent, with the brief's safety rules (`docs/decisions.md`): a denylist, debuggable builds or packages named in config only, and an explicit `--crawl`.

## To verify in the RFC

- Do Maestro and Detox release `UiAutomation` when they exit, so step 2 can capture immediately?
- Is the service actually suppressed while they run, on API 30 to 36?
- The minimum interval between service screenshots.
- How to deduplicate screens and states (structural signature) and name them stably.

## Why

Framework-agnostic before framework-specific. Steps 1 and 2 need no new on-device component, and step 3 covers whatever the first two cannot.

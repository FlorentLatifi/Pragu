# Pragu status

Last updated: 2026-10-28, end of M0 session 2. **M0 is complete and waiting for Florent's approval.**

## Decisions made (Florent delegated "take the decisions you think are best")

- Repo: `FlorentLatifi/Pragu` (the `pragu` GitHub name is taken). No Mac, so iOS waits for a Mac or macOS CI.
- Free options only: no domain; docs will go on GitHub Pages.
- Apache-2.0 with DCO sign-off (ADR-005). pnpm 12, TypeScript 6.0.3, Vitest 5, ESLint 10 + Prettier, Node >= 22.13 (ADR-002).
- Capture via Instrumentation + UiAutomation; the agent talks only through adb (ADR-001, ADR-006).
- Label suggestions (M4): local by default, own API key only as an opt-in.
- Design is done together: three directions are ready to choose from.

## Done (verified)

- **M0 exit criterion met on Florent's laptop.** `pnpm fixture:scan` scans `fixtures/rn-shop` on the `medium_phone` emulator (API 36), and the report shows the 3 seeded barriers on the screenshot. `pnpm fixture:verify`: 3 true positives, 0 false positives, 0 false negatives, 3 true negatives. That is a walking-skeleton check on six labelled elements, not a precision claim.
- **CI** on every push and PR: TypeScript job (lint, typecheck, tests, build on Node 22 and 24) and Android job (build, JVM tests, Android Lint, no-INTERNET check). Result of the last run: see "CI" below.
- Agent (657 KB APK): Instrumentation + UiAutomation, wait-until-settled capture, abstract socket with uid 0/2000 allowlist, protocol 1, 20 JVM tests. CI's lint caught a crash on API 26–27 (`LocalServerSocket` is not `Closeable` there); fixed.
- Core, report, CLI: 105 tests; `packages/core` at 100% line coverage.
- Docs: PRD, technical design, ADR-001 to ADR-006, STRIDE threat model with privacy review, test and evaluation strategy, M1 plan, design process with three directions.
- Project files: CLAUDE.md, README, LICENSE, CONTRIBUTING (DCO), SECURITY, ROADMAP, Dependabot.

## First measurements

One machine (HP laptop, Ryzen 7 5825U), emulator `medium_phone`, single runs. M1 sets budgets from repeated runs.

| Measure | Value |
|---|---|
| Scan with the app already installed, warm | 4.5 s (first run after install: 9.9 s) |
| Scan including the 22.8 MB fixture APK install | 33.5 s |
| CLI cold start (`pragu --version`) | 167 ms |
| Report for one screen | 117 KB, of which the PNG is 78 KB |
| Nodes on the cart screen | 32; 10 carry `testID`s; 12 of 12 text nodes report a rendered size |

## CI

Green on `main` at `3788a59` (run 40602524926): TypeScript on Node 22 and 24, and the Android agent job, all pass.

## In progress

Nothing. Waiting for Florent.

## Next

1. Florent picks a report direction: open `docs/design/directions.html` and reply with A, B, C or a mix.
2. Florent approves the M1 plan (`docs/plans/m1.md`). M1 starts with Pragu Bench v1 and agent hardening.
3. First owner-implements task: the `target/size` warning tier (below 48 dp), with Claude reviewing.

## Notes and risks

- Disk: 19 GB free on `C:`.
- Agent lint warnings to clear in M1: compile and target SDK 37 are available; `dataExtractionRules`; app icon.
- Dependabot PR #1 proposes TypeScript 7 and `@types/node` 26, which ADR-002 rules out; Dependabot now ignores both. Florent can close #1.
- For SECURITY.md to work, Florent enables private vulnerability reporting: repo Settings → Security → Private vulnerability reporting.
- The home network drops DNS lookups under load; the build scripts cache lookups per JVM.
- The Android CLI collects metrics by default: always `--no-metrics`.
- pnpm's release-age guard stays on; pin older versions instead of adding exclusions.
- The old folder `C:\Users\flore\OneDrive\Desktop\Pragu` holds an outdated copy of the first three docs and can be deleted.
- Local toolchain: JDK 17 in `C:\dev\tools\jdk-17` (needed for fixture builds); Android SDK in `%LOCALAPPDATA%\Android\Sdk`.

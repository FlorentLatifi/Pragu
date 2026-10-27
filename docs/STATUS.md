# Pragu status

Last updated: 2026-10-27 (M0, session 1; stopped at the usage limit mid-milestone).

## Decisions made (Florent delegated "take the decisions you think are best")

- Repo: `FlorentLatifi/Pragu` (the `pragu` GitHub name is taken). No Mac, so iOS is out of scope until a Mac or macOS CI is available.
- Free options only: no domain purchase; docs will go on GitHub Pages.
- License: Apache-2.0 with DCO sign-off for contributions (LICENSE file still to add).
- Tooling: pnpm 12.15.0 workspaces; TypeScript 6.0.3 (typescript-eslint does not support TS 7 yet); Vitest 5; ESLint 10 strict type-checked + Prettier; Node >= 22.13 (CI: 22 and 24).
- The fixture app is a standalone npm project outside the workspace, like a real user's app.
- Label suggestions (M4): local by default, own API key only as an opt-in.
- Design: done together with Florent (directions page still to prepare).

## Done (verified)

- Project moved to `C:\dev\pragu`, git initialised, remote `origin` = `FlorentLatifi/Pragu`. Nothing pushed yet.
- Toolchain: Temurin JDK 17 (portable, `C:\dev\tools\jdk-17`), pnpm 12.15.0, Android SDK at `%LOCALAPPDATA%\Android\Sdk` (platforms 36 and 37.0, build-tools 36.0.0 and 37.0.0, NDK 27.1.12297006, CMake 3.22.1), `ANDROID_HOME` and PATH set for the user. Florent approved the Android SDK licences.
- Emulator `medium_phone` (API 36 Google Play image, 1080×2400, 420 dpi) boots with WHPX acceleration. No Windows setting or reboot was needed; the research note's "enable WHPX" row is superseded.
- `fixtures/rn-shop` (Expo SDK 58, RN 0.88.0): cart screen with 3 seeded barriers and correct twins, ground truth in `expected.json`. Release APK builds (`pnpm fixture:build`, 8m45s, 22.8 MB).
- `packages/core`: PAM model, Android normaliser, rules `name/interactive-missing`, `contrast/text`, `target/size` (with the WCAG spacing exception), engine, fingerprint. 100% line coverage.
- `packages/report`: self-contained HTML report with numbered callouts, light/dark toggle, golden file test.
- `packages/cli`: `pragu scan` (adb, agent session, `--from-capture`), exit codes 0/1/2/3. End-to-end test runs the whole pipeline from a saved capture.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass (105 tests).

## In progress

- Android agent (`agents/android`): Gradle 9.8.2 wrapper (checksum-verified), AGP 9.4.1 build files, manifest and the no-INTERNET-permission check task are written. Kotlin sources are not written yet; the folder is not committed.

## Next

1. Write the agent Kotlin sources: `PraguInstrumentation` (UiAutomation with `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`), `AgentServer` (abstract socket, peer UID 0/2000 only), request handler (`hello`, `capture`, `shutdown`), node snapshot to protocol-1 JSON (field names must match `AndroidRawNode` in `packages/core/src/android.ts`), screenshot PNG, wait-until-stable loop. Add JVM unit tests. Add `scripts/build-agent.mjs`.
2. Build the agent, start the emulator, run `pnpm build` then `pnpm fixture:scan`, and verify the report shows the 3 seeded issues. Add `scripts/verify-fixture.mjs` for `pnpm fixture:verify`.
3. M0 docs: PRD, technical design, ADRs 001–006, STRIDE threat model and privacy review, test and evaluation strategy, M1 plan. Facts verified so far (with sources): WHO 1.3 billion / 16% (fact sheet, 7 Mar 2023); Chen et al. ICSE 2020, "more than 77% apps" of 10,408; EAA applies from 28 June 2025; ADA Title II deadlines moved to 26 Apr 2027 / 26 Apr 2028 (Federal Register 2026-07663, 20 Apr 2026); Accessibility Insights for Android retired (accessibilityinsights.io).
4. `CLAUDE.md`, `README.md`, `LICENSE` (Apache-2.0 text from apache.org), `CONTRIBUTING.md` (DCO), `SECURITY.md`, `ROADMAP.md`, CI workflow (actions pinned by SHA: checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.0, setup-java v6.1.0, gradle/actions v6.4.0), Dependabot. Mark `gradlew` executable in git.
5. Push to `FlorentLatifi/Pragu` (approved by Florent) and get CI green.
6. Design collaboration kit: 2–3 report directions on one page, process doc, project `DESIGN.md`.
7. Wrap-up: walkthrough, 3 interview questions, owner-implements task (`target/size` 48 dp warning tier), M1 plan; stop for approval.

## Notes and risks

- Disk: about 18 GB free on `C:`. Docker Desktop's data disk is 37.8 GB; freeing space is Florent's call.
- The home network drops DNS lookups under load. `scripts/build-fixture.mjs` caches lookups per JVM; large SDK downloads go through the Android CLI first.
- cmdline-tools 23 replaced `sdkmanager` with the "Android CLI", which collects usage metrics by default. Always pass `--no-metrics`. Package names use `/`, e.g. `platforms/android-37.0`.
- pnpm 12 enforces a minimum release age; pin an older version instead of adding exclusions.

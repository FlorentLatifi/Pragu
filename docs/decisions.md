# Pragu decision register

- Made on 2026-11-03 by Claude, at Florent's request to settle the important decisions for the whole system in one pass. Florent can overrule any entry; his word wins.
- The founding brief stays the source of truth for scope. Entries that change a milestone or an exit criterion say **needs Florent's approval** and are not in force until he gives it.
- Bigger decisions have their own ADR; this register links to it.

**Budget: zero** (Florent, 2026-11-03). Only free tools and services; an option that costs money is not an option. **Owner tasks:** Florent asked Claude to implement them too (2026-11-03); each gets a walkthrough so he can still explain it.

**For every future session:** read this before deciding anything. Do not re-decide an entry. If its "revisit" trigger fires, or evidence contradicts it, write an ADR that supersedes the entry, then update this file. Section L lists what only Florent can decide: do not act on those without him.

## A. Product and scope

- **D-01 What v0.1 is.**
  - In: Android; `scan`, `init` (with `--github`), `doctor`, `report`, `baseline`, `rules`, `comment`; several screens per scan (D-02); HTML, JSON and SARIF; the GitHub Action (ADR-014); the Pragu score (ADR-012); `--redact` (D-33); the 14 brief rules where precision allows (D-08, D-09).
  - Out: flows beyond the `--no-launch` recipe, the crawler, a theme or font matrix beyond `--check-font-scale`, iOS, AI, source mapping beyond D-43's static hint, auto-fix.
- **D-02 Several screens per scan.** `screens: [{ name, deepLink? }]` in config, with a fresh app start per screen: the path the bench recorder already uses (ADR-016 step 1). *Why:* one screen per scan cannot serve a CI check; deep links work in React Native, Expo and Compose with no code change. *Revisit:* if design partners' apps lack deep links, bring `--flow` forward.
- **D-03 Screens that refuse screenshots** (`FLAG_SECURE`, common in banking apps): scan the tree anyway, skip pixel rules, and say so in the report, instead of failing the scan. *Found 2026-11-03:* Android 16 does not refuse the screenshot of a secure window, it paints the window black; Pragu treats a screen whose every visible text sits on pure black as having no screenshot. Implemented.
- **D-04 Scrolling:** v0.1 checks what is on screen. When a screen can scroll, the report says that only the visible part was checked. Scroll capture is for the M3 RFC.
- **D-05 Nothing phones home:** no telemetry, accounts, servers, dashboards or paid tiers in v0.x. Adoption is measured from public signals: npm downloads, GitHub dependents, design partners. Telemetry would need an ADR and would be opt-in.
- **D-06 English only** in the CLI, report and docs until 1.0. *Revisit:* a design partner needs a translated report for a client.
- **D-07 CLI output** stays plain text. Colour, if ever added, respects `NO_COLOR` and never carries meaning alone. Add `--verbose` (adb commands and timings) in M2, for support.

## B. Rules and severity

- **D-08 Severity gate.** An error rule needs precision ≥ 0.90 on the seeded bench. From v0.1 it also needs ≥ 0.90 on the real bench once the rule has at least 5 labelled barriers there; otherwise it ships as a warning. At 1.0: a Wilson 95% lower bound ≥ 0.80 on the real test set. Counts and intervals are always published (ADR-015). *Why:* 1.00 on one or two seeded cases is not evidence.
- **D-09 Order of the remaining rules:**
  1. Florent's three owner-task rules;
  2. `name/role-in-label` (info) and `structure/no-headings` (info); implemented 2026-11-03;
  3. `focus/order` (warning, low confidence), only after the transcript order is checked on a real phone (D-14). Before that, it would compare against an unverified model.
- **D-10 No rule plugins before 1.0.** Config turns rules off, changes severities and ignores issues, nothing more. *Why:* precision gates cannot cover outside rules, and the rule API will still change.
- **D-11 The Pragu score:** ADR-012.
- **D-12 Fix guidance** covers React Native, Compose and Views now. Flutter guidance arrives with a Flutter fixture (M3), SwiftUI and UIKit guidance with iOS. Never publish advice that no fixture has exercised.

## C. Evaluation and research

- **D-13 Real-app bench:** blind labelling, a held-out test set, Wilson intervals, and ATF as a comparator (ADR-015). Tooling implemented 2026-11-03 (`bench/real/PROTOCOL.md`, `record-real`, the blind labelling page, `evaluate --real`); no app labelled yet.
- **D-14 Checking the transcript against TalkBack:** Florent, on a physical phone, with TalkBack's developer setting "Display speech output". He swipes through the rn-shop cart and the Compose checkout and writes down each line. Shell-injected gestures could not move TalkBack's focus on the emulator (2026-10-29). A later automation idea: Pragu moves accessibility focus itself and reads TalkBack's spoken-text toasts from accessibility events. That checks wording, not order.
- **D-15 `focus/order` waits for D-14.**
- **D-16 The M1 exit criterion "20 screens"** is met by the real bench in M2 (at least 20 distinct screens across at least 5 apps), not by fixtures. Approved by Florent on 2026-11-03.
- **D-17 Thesis (recommendation; Florent decides):**
  - RQ1: precision and recall of Pragu versus ATF on the held-out real bench.
  - RQ2: do "who it hurts" messages change how fast and how well developers fix barriers (a small controlled study)?
  - RQ3: adoption in CI with design partners.
  Decide early: blind labelling and keeping raw data start in M2.

## D. Architecture and code

- **D-18 Where logic lives.** The PAM stays platform-neutral. Rules run in TypeScript on the developer's machine; the agent only captures. ATF is never part of the product's rules, only the bench comparator.
- **D-19 Report:** typed templates (ADR-003 amendments). Preact only when the report needs real client state: navigating 50+ screens, sorting, search.
- **D-20 Screenshots in reports:** downscaled to 720 px wide (twice the display width) by a box filter in plain TypeScript, kept as PNG. Analysis uses full resolution first; the full-size PNG stays in `capture/`. No WebP dependency. Budget: a 20-screen report ≤ 3 MB, set after measuring. *Revisit:* above 3 MB after downscaling.
- **D-21 Agent install** only when the device lacks the bundled version (ADR-013). Implemented: the device's installed APK is compared by SHA-256.
- **D-22 Config** is validated strictly, with friendly errors, and follows the result schema's pre-1.0 versioning policy.
- **D-23 ktlint or detekt** (promised for M1 in ADR-002) are deferred: Android Lint is enough for about 700 lines of Kotlin. *Revisit:* above 2,000 lines, or when a second person writes Kotlin.
- **D-24 Expo config plugin** (brief, M3): its purpose is set in the M3 RFC. Working assumption: register a deep-link scheme, and later install the dev-only source-mapping plugin (D-43). Nothing is built before then.

## E. Platforms

- **D-25 Android versions:** API 30+ (Android 11) is supported. API 26–29 runs with a `doctor` warning that some checks are less reliable. CI: the emulator e2e on API 36 for every push (exact bench), plus API 30 weekly (precision ≥ 0.90, not exact equality, because rendering differs). `minSdk` stays 26. Implemented: weekly API 30 run with `bench evaluate --bar-only`, which fails on false alarms and warns about rules that go silent. *First run, 2026-11-03:* no false alarms; `text/scaling-truncation` silent on API 30 (ROADMAP).
- **D-26 Compile and target SDK 37** in M2, verified on the emulator. This clears the lint warning. Implemented.
- **D-27 The CLI runs on Windows, macOS and Linux.** CI adds `windows-latest` and `macos-latest` to the unit-test matrix (free on public repositories). The emulator job stays on Linux. Implemented.
- **D-28 Flutter on Android** already exposes its semantics through Android accessibility. A Flutter fixture and Flutter fixes come in M3. A separate Views fixture is not needed (React Native exercises the View system) unless a design partner needs one.
- **D-29 iOS:** a spike in M3 on GitHub's macOS runners (free on public repositories); no Mac is bought (zero budget, Florent, 2026-11-03). If CI-only development proves too slow, iOS waits.

## F. More than one screen (M3)

- **D-30 Direction:** ADR-016. Declared screens, then end-of-flow capture, then watch mode, then the crawler. The v0.1 docs show the `maestro test … && pragu scan --no-launch` recipe once it is verified on the emulator.
- **D-31 Crawler safety** (a hard rule from the brief):
  - never tap denylisted actions: pay, buy, delete, send, log out, and their Albanian and German equivalents, by text and by id;
  - run only on debuggable builds, or on packages listed in `crawl.packages`;
  - always require an explicit `--crawl`.
- **D-32 Conditions matrix:** font scale × theme in M3, as one `conditions` setting that generalises `--check-font-scale`. Every device setting is restored in `finally` and on Ctrl+C (ADR-011).

## G. Distribution and releases (ADR-013)

Three npm packages in lockstep; the signed agent bundled in `pragu` and checked by SHA-256; install only when needed (D-21); OIDC publishing with provenance; an SBOM per release.

## H. GitHub integration (ADR-014)

The composite action, `pragu comment`, "new" meaning not in the latest `main` result, fork pull requests, and minimal permissions. Implemented 2026-11-03 (`action.yml`, `pragu comment`, `pragu init --github`); CI dogfoods it on pushes.

## I. Security and privacy

- **D-33 `--redact` (M2), revised and approved by Florent on 2026-11-03:** a report meant for sharing. The app's text is covered in the screenshots (grey boxes over every text and hint) and replaced by `[redacted]` in names, texts, hints, window titles, quotes in issue messages and text evidence, so the transcript reads "[redacted], Button". Element ids, roles, bounds, measurements and fingerprints stay, since a fix needs them. No `capture/` folder is written; the covered screenshots are saved small in `screenshots/`, and the result says `redacted: true` (schema 0.11.0). Images are not covered. On by default in the GitHub Action for public repositories, which uploads only that report; off locally. *Why revised:* covering the screenshots alone left the same text in the transcript, messages, JSON and raw captures. Implemented.
- **D-34 Cloud folders:** warn, without blocking, when `--out` is inside OneDrive, Dropbox, iCloud Drive or Google Drive. Implemented.
- **D-35 AI providers (M4):** an OpenAI-compatible endpoint. The default must be a loopback address (a model the user runs locally). Any other address needs `--allow-remote-ai` plus config, and every run says what leaves the machine. Suggestions start deterministic (resource and icon names, nearby text); a model is added only if it beats that baseline on a labelled set.
- **D-36 Dependabot cooldown of 7 days** for npm, Gradle and Actions. *Why:* Dependabot rewrites the lockfile itself, so pnpm's release-age guard never sees its updates. Security updates are not delayed. Implemented 2026-11-03.
- **D-37 CodeQL and OpenSSF Scorecard** workflows in M2 (free on public repositories). Implemented (`.github/workflows/security.yml`).
- **D-38 Threat-model reviews** for the GitHub Action (M2: artifacts, fork pull requests), watch mode and the crawler (M3), AI (M4), and auto-fix (M5).

## J. Docs, brand and community

- **D-39 Docs site:** Astro Starlight in `apps/docs`, on GitHub Pages, in the Signal tokens. The rules reference is generated from rule metadata. Local search, no analytics. *Alternatives:* VitePress, Docusaurus; Starlight wins on accessibility defaults. Implemented 2026-11-03 (`apps/docs`, Astro 7.4.2, Starlight 0.42.7; `docs.yml` builds it and runs axe on every change, and deploys once Pages is on and `DOCS_DEPLOY` is `true`).
- **D-40 Brand:** the name Pragu and the tagline stay. A wordmark only; no logo spend before 1.0.
- **D-41 Governance:** Implemented 2026-11-03 (`GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, templates, `dco.yml`).
  - BDFL (Florent), written down in `GOVERNANCE.md`;
  - the current Contributor Covenant before v0.1;
  - DCO sign-off enforced on outside pull requests (Florent's own commits are exempt: he owns the copyright);
  - issue and PR templates, and "good first issue" from owner-task-sized items.
- **D-42 Branch protection after v0.1:** pull requests and green checks for everyone except Florent (his setting).

## K. Later milestones (each still needs its RFC)

- **D-43 Source mapping:**
  - Tier 1: search the repository for the element's `testID` or resource id; exactly one match gives "likely here". It can ship in M2 as a stretch, for the PR comment's `file:line`.
  - Tier 2 (M4): an opt-in, dev-only Babel plugin. React 19 dropped the element `_source`, so the RFC must find another carrier.
- **D-44 Auto-fix (M5):** GitHub suggested changes on the pull request, verified by a rebuild and re-scan in CI. No autonomous commits to users' repositories.
- **D-45 What 1.0 means:** a frozen schema (breaking changes are major versions), stable flags and config, the deprecation policy in force, the real-bench gates of D-08, and 3 external teams (brief).

## L. Florent decides (recommendation in brackets)

- **F-1** Reserve the `@pragu` npm organisation. [Now: it is free, and the name could be taken.]
- **F-2** ~~Buy `pragu.dev`~~: no paid domain (zero budget, Florent, 2026-11-03). The docs stay at `florentlatifi.github.io/Pragu`.
- **F-3** Where the repository lives. [Stay on `FlorentLatifi/Pragu` until there is a second maintainer: no overhead, clear authorship.]
- **F-4** ~~Approve D-16 and the M2 plan~~: approved on 2026-11-03.
- **F-5** Create the release keystore and the GitHub secrets; set up npm trusted publishing (ADR-013).
- **F-6** Turn on private vulnerability reporting (`SECURITY.md` depends on it).
- **F-7** Choose 3 design partners, under this protocol: Pragu runs on their machine and their test build; screenshots, results and recordings stay with them; Florent receives only what they choose (by default, per-rule counts of confirmed and false findings); their app never enters the public bench or a public post without written permission.
- **F-8** The launch date, and approval of the posts (Show HN, r/reactnative, Expo).
- **F-9** A trademark search (EUIPO TMview) before launch, and a contact email for the code of conduct.
- **F-10** Dependabot PRs #3 (AGP 9.5.0), #4 (setup-gradle 6.4.1) and #5 (ESLint 10.14.0, typescript-eslint 8.72.1): all green. [Merge, once each release is a week old.]
- **F-11** Thesis questions (D-17).
- **F-12** GitHub Sponsors. [After 1.0, if there is traction.]

## M. Left to Florent's owner tasks on purpose

These are his to work out, because working them out is the learning:

- how SARIF locates a finding on a screen with no source file (`docs/plans/owner-task-sarif.md`);
- whether the 48 dp tier is its own rule id or a per-finding severity (`docs/plans/owner-tasks-rules.md`).

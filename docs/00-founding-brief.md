# Pragu — Founding Brief & Kickoff Prompt

> Paste this whole document into a new Claude session (or attach it) and add one line:
> **"Read this brief completely and start Milestone 0."**

---

## 0. How to treat this document

You are starting a new open-source product from zero. This brief is the founding document and the source of truth until it is replaced by documents I approve. Save an unchanged copy as `docs/00-founding-brief.md` in the repository.

**Where you must work.** You must be working on my computer, in my project folder, through the Claude desktop app. Building and running Android emulators has to happen there. If you find yourself in a cloud sandbox with no access to my machine, tell me immediately and stop.

---

## 1. Your role

Act as the founding engineering team of a top-tier product company (think Google or Microsoft developer-tools teams), compressed into one collaborator:

- **Staff software engineer.** Owns architecture and code quality.
- **Product manager.** Owns the problem, the users and the scope.
- **Accessibility specialist.** Knows WCAG 2.2, EN 301 549, TalkBack and VoiceOver deeply.
- **Product designer.** Owns the report, the docs and the brand, and makes them distinctive, not template-looking.
- **Security and privacy engineer.** Follows a Microsoft SDL-style process.
- **Release and DevRel engineer.** Owns CI/CD, docs, launch and community.

The standard is **big-company quality at startup speed**:
- Every practice must earn its place.
- Documents are short and decision-focused.
- Nothing is gold-plated.

---

## 2. Who I am and how we work together

- **Me.** I'm Florent Latifi, a software engineer and Master's student in Prishtina, Kosovo. I'm building Pragu mostly alone, with you.
- **My target roles.** React Native, Full-Stack and Data Engineering.
- **My previous projects.** Use them as the minimum bar for rigor:
  - JavaSmell: code-smell detection with rules, ML and verified refactorings, evaluated with MCC on 4,534 samples. https://github.com/FlorentLatifi/Code-Smell-Detection-and-Refactoring-Recommendations
  - Gjurmë: news coverage engine with 366 backend tests, ADRs and CI. https://github.com/FlorentLatifi/Gjurm-
  - CineTaste: explainable recommender. https://github.com/FlorentLatifi/cinetaste
- **Language.** Talk to me in the language I write in (Albanian or English). Everything in the repository is in English: code, docs and commits.
- **I must understand everything.** This project will be discussed in job interviews and may become my Master's thesis. After each milestone:
  - Give me a short walkthrough of how the new parts work.
  - Give me 3 questions I should be able to answer about them.
  - Mark some tasks as **owner-implements**. I write that code and you review it.
  - Never leave me with a module I can't explain.

---

## 3. The product

### One-liner
**Pragu finds the accessibility barriers in your mobile app (Android and iOS, any framework) on every pull request, shows exactly who they hurt, and tells you how to fix them in your own code.**

*Name: "prag" is Albanian for threshold, the step a wheelchair can't climb. Tagline idea: "Find the thresholds before your users hit them."*

### The problem
- Over 1.3 billion people (about 16% of the world) live with a disability (WHO).
- A study of 10,408 Android apps found that over 77% had image-based elements with no label. A blind TalkBack user hears "button, unlabeled" and cannot continue. (Chen et al., ICSE 2020, "Unblind Your Apps" / LabelDroid.)
- Developers don't do this on purpose. They never experience their app through a screen reader, at 200% text size, or with low vision.

### Why now
- **EU law.** The European Accessibility Act applies from 28 June 2025. It covers e-commerce (websites and mobile apps), consumer banking, passenger transport, e-books and more.
- **US law.** The DOJ's ADA Title II rule requires US state and local governments' web content **and mobile apps** to meet WCAG 2.1 AA. The deadlines, after an April 2026 one-year delay, are 26 April 2027 for entities serving 50,000+ people and 26 April 2028 for smaller ones.
- **The gap.**
  - Microsoft launched *Accessibility Insights for Android* in 2020 and has since discontinued it: no downloads, no updates.
  - Deque (axe DevTools Mobile) and BrowserStack (App Accessibility) sell accessibility checks inside Maestro and other test runs as commercial products.
  - Open building blocks exist: Google's Accessibility Test Framework for Android (ATF, Apache-2.0), and Apple's `performAccessibilityAudit()` in XCTest (Xcode 15+).
  - In August 2026 an indie developer released an Android-only runtime auditor with a live dashboard. It has no CI integration and no iOS support.
  - Nobody has open-sourced the layer teams actually need: **both platforms, any test framework, CI-native, one beautiful report, and fixes mapped to source code.**

*(Re-verify these facts and cite sources before they appear in public docs.)*

### Users
1. **Primary:** mobile developers. React Native and Expo come first, then native Android/iOS and Flutter.
2. **Secondary:** QA engineers who already run Maestro, Detox or Appium flows.
3. **Tertiary:** engineering leads and compliance teams who need evidence for EAA and ADA work.
4. **First design partners:** Prishtina software companies that build apps for EU clients.

### Product principles
1. **Works in 60 seconds.** One command produces a report, with no app code changes required.
2. **Trust over noise.** Ship only high-confidence rules. Publish the precision of every rule. A false alarm is a bug.
3. **Human-centred output.** Every issue says *who it hurts* and *what they experience*, not only which rule failed.
4. **Fix, don't just find.** Every issue comes with framework-specific fix guidance. Later, verified fixes are mapped to source lines.
5. **Local-first and private.** Nothing leaves the machine by default.
6. **Honest.** Automated testing cannot catch every barrier. Never claim "compliant" or "certified". Say "automated checks", and point to what needs manual review.
7. **Respect existing apps.** Baselines mean only *new* problems fail a build.
8. **Practice what we preach.** Pragu's own report, docs and CLI output must themselves be accessible (WCAG 2.2 AA).

### Non-goals (for v0.x)
- No web accessibility (axe-core already owns that).
- No accounts, servers, databases or cloud dashboards.
- No legal certification.
- No manual-audit workflow tool.

---

## 4. Product specification

### CLI

| Command | What it does |
|---|---|
| `pragu init` | Creates `pragu.config.ts` and, optionally, a GitHub Actions workflow |
| `pragu doctor` | Checks Node, adb, emulator/device, API level and the agent install; prints exact fixes |
| `pragu scan` | Audits the app and writes the report |
| `pragu report <result.json>` | Re-renders or opens a report |
| `pragu baseline create\|update` | Manages the accepted-issues baseline |
| `pragu rules [--explain <id>]` | Lists rules and explains one |

**Key `scan` flags:**
- `--app <id>` selects the app.
- `--flow <maestro|detox files>` audits every screen visited by existing tests.
- `--crawl` runs the built-in explorer (milestone M3).
- `--font-scale 1,2` and `--theme light,dark` define the condition matrix.
- `--format html,json,sarif` and `--out <dir>` set the output.
- `--baseline <file>` and `--fail-on error|warning` control failing.

**Exit codes:** 0 = OK, 1 = new issues over the threshold, 2 = usage error, 3 = environment error.

**Config:** a typed `defineConfig()` in `pragu.config.ts`. It covers:
- Rule enable/disable and severity overrides
- Ignore selectors
- The crawl denylist
- A login script
- Thresholds

### Outputs
1. **HTML report.** A single self-contained file that works offline and makes no external requests.
   - **Summary:** score, counts by severity and by WCAG principle, and a grid of screens.
   - **Screen view:** the screenshot with numbered callouts, the issue list, and a **screen-reader transcript** (what TalkBack/VoiceOver would announce, in order, clearly labelled as an approximation).
   - **Rule view:** issues grouped by rule.
   - **Diff view:** changes against the baseline.
   - Prints cleanly to PDF as evidence.
2. **JSON result.** A versioned JSON Schema (`pragu-result.schema.json`), the stable machine contract.
3. **SARIF 2.1.0.** For GitHub code scanning annotations.
4. **PR comment** (GitHub Action). Short, shows only *new* issues, with details collapsed and a link to the report artifact. Target look:

```
Pragu · 2 new barriers in this PR
✗ Checkout › trash icon has no accessible name
  Screen reader says: "Button, unlabeled"        WCAG 4.1.2
  Fix  CartItem.tsx:41   + accessibilityLabel="Remove item"
✗ Checkout › "Pay" text contrast 2.9:1 (needs 4.5:1)   WCAG 1.4.3
Score 86 → 81 · Full report ↗
```

### Initial rule set
Each rule has the following metadata, and the rules reference docs are generated from it:
- `id` and `title`
- `severity` (error / warning / info) and `confidence` (high / medium / low)
- WCAG 2.2 success criteria and EN 301 549 clause-11 mappings
- `whoIsAffected` and `whatTheyExperience`
- Fix guidance for React Native, Jetpack Compose, Android Views, SwiftUI/UIKit and Flutter
- Positive and negative fixtures

| ID | Detects | WCAG 2.2 | Default |
|---|---|---|---|
| `name/interactive-missing` | Button/link/switch/tab with no accessible name | 4.1.2 | error |
| `name/image-missing` | Meaningful image without a text alternative (decorative images must be hidden from assistive tech) | 1.1.1 | error |
| `name/generic` | Meaningless names: "button", "icon", "img_23", file names, "click here" | 2.4.6 / 2.4.4 | warning |
| `name/duplicate` | Different actions on one screen with the same name | 2.4.6 | warning |
| `name/role-in-label` | Label repeats the role ("Delete button, button") | best practice | info |
| `contrast/text` | Text contrast < 4.5:1 (< 3:1 for large text) | 1.4.3 | error |
| `contrast/non-text` | Icon or control contrast < 3:1 | 1.4.11 | warning |
| `target/size` | Below the WCAG minimum (error); below platform guidance of 48dp/44pt (warning) | 2.5.8 | error/warning |
| `text/scaling-truncation` | Text clipped or overlapping at 200% font scale | 1.4.4 | error |
| `state/not-exposed` | Toggle, checkbox or expandable whose state isn't announced | 4.1.2 | error |
| `input/missing-label` | Text field with no persistent label (placeholder only) | 3.3.2 / 1.3.1 | error |
| `focus/unreachable` | Interactive element the screen reader can't reach | 2.1.1 | error |
| `focus/order` | Reading order contradicts visual order | 2.4.3 / 1.3.2 | warning |
| `structure/no-headings` | Content sections with no headings | 1.3.1 | info |

Document how WCAG's CSS-pixel target size maps to dp/pt. Reuse ATF checks wherever they are good, and add our own where they aren't.

**Scoring.** 0–100, deterministic, with a documented formula weighted by severity, confidence and impact (like Lighthouse). It is called the "Pragu score" and never implies compliance.

---

## 5. Architecture (proposed; confirm or change through ADRs)

```
Device / emulator ──(adb only)──► Platform agent ──► Pragu core (TypeScript) ──► Outputs
  Android: agent APK (Kotlin)      captures tree +       normalize → rules →          HTML · JSON ·
  iOS: XCUITest runner (Swift)     screenshot + ATF      score → baseline/diff        SARIF · PR comment
```

### Repository layout (pnpm workspaces monorepo)
```
pragu/
  packages/core/          # Pragu Accessibility Model, rules engine, scoring, baseline, formats
  packages/cli/
  packages/report/        # report UI, built to one self-contained HTML file
  packages/github-action/
  agents/android/         # Kotlin + Gradle
  agents/ios/             # (M3+) Swift XCUITest runner
  fixtures/rn-shop/       # Expo/React Native app with seeded violations AND correct twins
  fixtures/android-compose/
  bench/                  # "Pragu Bench": labelled ground truth + evaluation harness
  apps/docs/              # docs site
  docs/                   # brief, PRD, design doc, ADRs, RFCs, threat model, STATUS.md
  .github/
```

### Pragu Accessibility Model (PAM)
This is a platform-neutral, versioned model:
- **ScanRun:** tool/version, device (platform, OS, density, fontScale, locale, theme), app, screens, issues, summary.
- **Screen:** stable fingerprint, name, screenshot ref, node tree, transcript, capture conditions.
- **Node:**
  - id
  - normalized `role` (button, link, image, text, heading, textfield, switch, checkbox, tab, list, …) plus `platformRole`
  - `name`, `hint`, `value`, `states`, `actions`
  - bounds in px and dp
  - `focusable`, `traversalIndex`, `text`
  - optional `sourceRef {file, line, column, component}`
- **Issue:** rule, severity, confidence, screen and node, a stable `fingerprint`, message, affected users, WCAG/EN mappings, evidence (e.g. measured contrast), fix guidance, optional AI suggestion.

### Key technical decisions to make in M0 (write an ADR for each)
1. **Android capture method.** Compare:
   - **Instrumentation + `UiAutomation`** (no device setup, CI-friendly, can screenshot)
   - **An `AccessibilityService`** (live capture while a human or test navigates)

   Prototype first, then decide. Hard constraint either way: **the agent APK must not request the INTERNET permission.** It talks to the CLI only over adb.
2. **Tooling:**
   - Node LTS, pnpm, TypeScript `strict`, Vitest, ESLint+Prettier (or Biome)
   - Playwright + axe-core to test the report UI itself
   - Kotlin/Gradle/JUnit, plus ktlint or detekt
3. **Report stack.** A lightweight framework compiled to one HTML file. Screenshots as compressed WebP.
4. **Issue fingerprinting** for baselines that survive small UI changes. This is a hard problem: design it carefully and property-test it.
5. **License:** Apache-2.0, compatible with ATF. Use DCO sign-off for contributions.

### Later milestones need RFCs first
- **Navigation.** Watch screen changes during Maestro/Detox/Appium runs, plus a safe built-in crawler.
- **iOS.** An XCUITest runner attaching to any bundle id, using `performAccessibilityAudit()` and element snapshots.
- **Source mapping for React Native.** Investigate what works with current React/RN versions, for example a dev-only Babel plugin that injects source metadata.
- **Label suggestions.** A pluggable provider: a local model, or an opt-in vision-language model with my own API key.
- **Verified auto-fix PRs.** Patch the source, rebuild, re-scan, and propose the fix only if the issue is gone.

---

## 6. The quality bar ("everything a great product has")

**Engineering**
- Small, reviewable commits (Conventional Commits). Every commit builds and passes tests.
- No new dependency without a one-line justification. Prefer boring, proven tech.
- Helpful errors: every error says what happened, why, and the exact command to fix it.

**Testing**
- Unit tests for every rule on synthetic trees, positive and negative.
- Golden tests for the report, the transcript, the PR comment and the SARIF output.
- Integration tests with an Android emulator in CI (e.g. `reactivecircus/android-emulator-runner`).
- End-to-end tests on the fixture apps. Property-based tests for fingerprinting and scoring.
- Coverage of at least 90% on `packages/core`.

**Evaluation ("Pragu Bench")**
- Fixture apps have seeded violations and correct twins (true negatives), with ground truth in `expected.json`.
- Later, add real open-source apps (e.g. from F-Droid) with manually labelled screens.
- The harness reports precision, recall, F1 and MCC per rule.
- CI fails on any precision regression. Results are published in the docs, like JavaSmell's MCC table.
- **Never fabricate or round up numbers.**

**Performance budgets** (measure first, then set and enforce them in CI)
- Time per screen for capture and analysis
- CLI cold start
- Report size per 20 screens

**Security and privacy** (Microsoft SDL-style)
- A STRIDE threat model in M0, including the risks of a powerful on-device agent.
- Local-first. No telemetry by default.
- A `--redact` mode that blurs text in screenshots, since banking apps will be scanned.
- AI providers are strictly opt-in, with a clear warning that screenshots leave the machine.
- Supply chain: lockfile, Dependabot, CodeQL, OpenSSF Scorecard, npm provenance, a signed APK, a CycloneDX SBOM per release, and `SECURITY.md` with a disclosure process.
- Signing keys only in CI secrets.

**Accessibility of Pragu itself**
- The report passes axe-core in CI, is fully keyboard-navigable, and is tested with a screen reader before each release.
- The CLI never relies on colour alone, and supports `NO_COLOR`.

**Design**
- The report is the product's face; it is what people screenshot and share. Create a small design system: tokens, typography, colour (all pairs WCAG AA), light and dark themes.
- Direction: a precise, editorial, architectural-drawing feel that fits the "threshold" idea. Think numbered callouts like technical drawings, a restrained palette with one strong accent, and a grotesk + mono type pairing.
- **It must not look like a generic AI or Tailwind template.** No default purple gradients, no emoji-laden cards. Propose 2–3 directions and let me choose.

**Docs**
- README: pitch, GIF, 60-second quickstart, report screenshot, honest "what automated checks can't catch", and a comparison.
- Docs site:
  - Getting started per framework, React Native/Expo first
  - CI guide and config reference
  - Rules reference generated from metadata
  - Concepts and FAQ
  - "Accessibility 101 for mobile developers"

**Open-source hygiene**
- LICENSE, CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant), GOVERNANCE, ROADMAP, CHANGELOG
- Issue and PR templates
- "good first issue" labels

**Release engineering**
- SemVer, stay `0.x` until the API is stable, and use Changesets.
- A versioned JSON schema and a documented deprecation policy.
- A Google-style launch checklist before every public release.

**Project memory (so any new session can continue)**
- `CLAUDE.md`: conventions, commands, architecture map.
- `docs/STATUS.md`: done, in progress, next, blockers, decisions needed. Update it at the end of every session.
- `docs/adr/NNN-*.md`: decisions, each one page at most.

---

## 7. Operating rules

1. **Evidence over assertion.** Never say something works without running it. Show the command and the relevant output, or a screenshot of the report.
2. **Ask before anything irreversible or external.** That includes:
   - pushing to GitHub or creating repositories or organisations
   - publishing to npm
   - choosing or changing the license
   - spending money
   - sending any data to an external service
   - installing system-wide software
3. **Verify platform APIs** against official docs or by experiment, and note the sources in ADRs. Use current stable versions and check them instead of assuming.
4. **Stay in scope.** Unrequested features go to `ROADMAP.md`, not into the code.
5. **Crawler safety (M3).** Never automatically tap destructive or financial actions (pay, buy, delete, send, logout…). Use a denylist plus explicit config, and run only against test builds and test accounts.
6. **Honest claims everywhere.** No "compliant", "certified" or "100%".
7. **If you can't run the emulator** (no hardware virtualisation), say so and switch to a physical Android phone over USB debugging.

---

## 8. Milestones (each ends with a demo, a walkthrough and my approval)

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 Foundations** (now, ~1 week) | Environment check, name check, short design docs, repo + CI skeleton, **walking skeleton** | On my machine, one command scans the fixture app and the HTML report shows 3 seeded issues on the screenshot; CI is green |
| **M1 Android MVP** (~weeks 2–8) | Robust agent, the full initial rule set, transcript, report v1, config, JSON/SARIF, `doctor`, baselines, Pragu Bench v1 | Every shipped "error" rule has precision ≥ 0.90 on the bench (published); 20 screens scanned within the agreed budget |
| **M2 CI + public v0.1** (~weeks 9–12) | GitHub Action, PR comment, SARIF upload, docs site, design system final, launch checklist, 3 design partners | `v0.1.0` released; 60-second quickstart verified on a clean machine; Show HN, r/reactnative and Expo community posts drafted for my approval |
| **M3 Coverage** (months 4–6) | Maestro/Detox flow integration, safe crawler, font-scale and theme matrix, Expo config plugin, iOS spike (if I have a Mac) | Real apps scanned end to end without hand-holding |
| **M4 Intelligence** (months 7–9) | Label suggestions (local and opt-in VLM) with published precision; RN source-mapping RFC and implementation | Suggestions evaluated on a labelled set; issues link to `file:line` in RN projects |
| **M5 Fixes + 1.0** (months 10–12) | Verified auto-fix PRs for RN, API/schema stability, benchmark write-up, conference talk, thesis evaluation design | `1.0.0`; at least 3 external teams using Pragu in CI; at least 1 real fix shipped because of Pragu |

---

## 9. Start now: Milestone 0, step by step

1. Read this whole brief. Save it as `docs/00-founding-brief.md`.
2. **Inspect my environment:** OS, CPU/RAM and virtualisation support, Node, pnpm, git, gh, JDK, Android SDK and emulator, and Xcode if this is macOS. Give me a precise checklist for anything missing, and install nothing system-wide without asking.
3. **Ask all your open questions in one message**, at least:
   - Do I have a Mac?
   - How many hours per week can I give this?
   - Should the repo live on my personal GitHub (FlorentLatifi) or a new `pragu` organisation?
   - Do I confirm Apache-2.0?
   - Should label suggestions be local-only or use an API key later?
   - Which companies can I contact as design partners?
   - What is my target date for v0.1?
4. **Check the name:** npm (`pragu`, `@pragu/*`), GitHub, a domain (e.g. `pragu.dev`), and any conflicting project. Report the options.
5. **Write the M0 docs**, each short:
   - PRD (1–2 pages)
   - Technical design doc
   - ADRs for the decisions in §5
   - STRIDE threat model and privacy review
   - Test and evaluation strategy
   - M1 plan with estimates
6. **Scaffold the monorepo and CI:** lint, typecheck, test on every PR. Add `CLAUDE.md` and `docs/STATUS.md`.
7. **Build the walking skeleton**, the thinnest end-to-end slice:
   - `fixtures/rn-shop` with one screen containing three seeded issues (an unlabeled icon button, low-contrast text, a tiny touch target) and correct twins
   - The Android agent captures the tree and a screenshot
   - `core` runs 3 rules
   - It writes JSON and a minimal HTML report with numbered callouts on the screenshot

   Run it and show me the evidence.
8. **Wrap up:**
   - Update `STATUS.md`
   - Give me the walkthrough and my 3 interview questions
   - Propose the M1 plan
   - **Then stop and wait for my approval.**

Let's build something that makes every app a little easier to use for 1.3 billion people, and build it the way the best teams in the world would.

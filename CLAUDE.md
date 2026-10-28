# Pragu

Open-source tool that finds accessibility barriers in mobile apps on every pull request. Source of truth for scope: `docs/00-founding-brief.md` (never edit it). Current state: `docs/STATUS.md`. Update STATUS.md at the end of every session.

## Commands

```bash
pnpm install            # Node >= 22.13, pnpm 12 (pinned in package.json)
pnpm lint               # ESLint (strict, type-aware) + Prettier check
pnpm typecheck          # tsc over every package and test, from source
pnpm test               # Vitest with coverage; packages/core must stay >= 90%
pnpm build              # emit packages/*/dist and bench/dist (needed before the CLI or the bench)
pnpm bench              # Pragu Bench: re-score rules on recorded fixture screens; fails if results differ (CI)
pnpm bench:update       # accept new bench results (rewrites bench/results.json and docs/bench/results.md)
pnpm bench:record       # re-record fixture screens on the emulator (after pnpm fixture:build)
pnpm agent:build        # Android agent APK + JVM tests + Android Lint + no-INTERNET check (JDK 17+, ANDROID_HOME)
pnpm fixture:build      # rn-shop release APK (JDK 17 required, about 9 min the first time)
pnpm fixture:scan       # scan the rn-shop cart screen on the running emulator; exit 1 = barriers found
node scripts/serve-reports.mjs   # view reports/ at http://127.0.0.1:4173
```

Android SDK tools: always pass `--no-metrics` to the `android` CLI (cmdline-tools 23+ collects metrics by default). Package names use `/`, e.g. `platforms/android-37.0`.

## Architecture map

| Path | What |
|---|---|
| `packages/core` | Pragu Accessibility Model (`model.ts`), Android adapter (`android.ts`), rules (`rules/`), engine, fingerprints. No runtime dependencies. |
| `packages/report` | One self-contained offline HTML report. No dependencies. |
| `packages/cli` | `pragu` command: adb orchestration, agent protocol client, scan pipeline. |
| `agents/android` | Kotlin agent APK: Instrumentation + UiAutomation, abstract-socket server (protocol 2: every window, trees for the app's own). |
| `fixtures/rn-shop` | Expo app with seeded barriers and correct twins on deep-linked screens (`rnshop://cart|product|form`). Standalone npm project, not in the workspace. |
| `bench` | Pragu Bench: ground-truth evaluation (precision, recall, F1, MCC per rule) on recorded fixture screens. |
| `docs/` | Brief, PRD, technical design, ADRs, threat model, test strategy, plans, research notes. |

The agent's JSON field names (`agents/android/.../Snapshot.kt`) must match `AndroidRawNode` in `packages/core/src/android.ts`. `SnapshotTest` locks the field list. Change both together and bump `PROTOCOL_VERSION`.

## Conventions

- English everywhere in the repo. Conventional Commits. Small commits, each passing lint, typecheck and tests.
- TypeScript strict; no `any`; ESM with `.js` import suffixes. Errors the user sees are `PraguError` with a fix.
- Every rule: metadata (WCAG, EN 301 549, who is affected, what they experience, RN/Compose/Views fixes), positive and negative tests, and a fixture barrier with a correct twin. A false alarm is a bug: prefer silence and lower confidence over guessing.
- Never claim "compliant", "certified" or "100%". Say "automated checks".
- No new dependency without a one-line reason in the PR. Keep pnpm's release-age guard; pin older versions instead of adding exclusions.
- The agent never gets the INTERNET permission (`verifyReleaseNoInternetPermission` enforces it).
- Unrequested features go to `ROADMAP.md`, not into code.
- Florent must understand every module: each milestone ends with a walkthrough, three interview questions and owner-implements tasks.

# M1 walkthrough

**For:** Florent, at the end of M1 (CLAUDE.md: every milestone ends with a walkthrough, three interview questions and owner-implements tasks). Read it with the code open; each section names the files to look at. It covers what M1 built, why it is built that way, and what is still missing.

## 1. One scan, end to end

`pragu scan` checks one screen. In order:

1. **CLI starts** (`packages/cli/src/main.ts`, `runScan`). Reads flags, loads `pragu.config.ts` with Node's own type stripping (`packages/cli/src/config.ts`), and merges flags over the config.
2. **Device and agent** (`packages/cli/src/adb.ts`, `scan.ts`):
   - picks the device;
   - installs the agent APK (`installAgent` reinstalls it when it was signed on another machine; it never touches the user's app);
   - starts it through `am instrument`.
3. **Agent captures** (`agents/android/agent/src/main/kotlin/dev/pragu/agent/`):
   - `AgentServer` listens on an abstract Unix socket and only accepts the shell or root user (`isTrustedPeer`). There is no network and no INTERNET permission, and it stops after 5 minutes idle.
   - `UiAutomationCapturer.capture` waits for the app to be idle, walks every window, and builds full trees for the app's own windows. It also adds `labeledBy`, checked state, text size and the characters an ellipsis hides.
   - `Snapshot.kt` turns this into JSON. Its field names are locked by `SnapshotTest` and must match `AndroidRawNode`.
   - Framing is one header line plus one JSON line (`Frames.kt`, `PROTOCOL_VERSION = 4`).
4. **Optional second capture** (`--check-font-scale`, `packages/cli/src/font-scale.ts`). Sets text to 200% and captures again. The original scale is always put back, even after an error, because it is the user's device.
5. **Normalise** (`packages/core/src/android.ts`):
   - `parseAndroidCapture` validates the untrusted JSON;
   - `normalizeAndroidCapture` turns Android's view of the world into the **Pragu Accessibility Model** (`model.ts`): role, accessible name, interactive, exposed, window, touch area or drawn size.
   - Everything toolkit-specific stops here. Rules only see `PamScreen`.
6. **Rules** (`packages/core/src/engine.ts`, `analyze`). Every rule runs on every screen. Findings become issues with a fingerprint (`fingerprint.ts`), sorted top-to-bottom so callout numbers read naturally.
7. **Config and baseline**:
   - rules that are turned off, severity changes and ignores (with a required reason, counted in `summary.ignored`) apply here;
   - `--baseline` marks known issues `inBaseline` (`baseline.ts`), so only new ones fail the exit code.
8. **Output**: `result.json`, which matches `schema/pragu-result.schema.json`, and one offline HTML report (`packages/report/src/index.ts`). The exit code is set by `exitCodeFor`.

`pragu scan --from-capture <file>` skips steps 2–4 and re-runs everything after them on a recording. The bench, the report golden test and design sessions all rely on this.

## 2. The model is the product

The **Pragu Accessibility Model** decides what Pragu can and cannot see. Three choices from M1 are worth knowing by heart:

- **Read Compose the way TalkBack does** (ADR-009). A role on a child is not a separate control. A Compose clickable reports its *touch area*, not its drawn size, so `boundsAreTouchArea` tells `target/size` which one it got. The first Compose scan gave 12 issues where 5 were real. The model fixes were general (none special-cased the fixture).
- **Windows** (ADR-008). The agent sends every window. Rules judge only the app's topmost one, skip covered elements, and leave WebView content to web tools (`rules/scope.ts`).
- **Who is exposed** (`exposedToAssistiveTech`). This drives `focus/unreachable`, `name/image-missing` and the transcript. "TalkBack stops here" is a model question, not a rule question.

## 3. Rules: same shape, different evidence

Each file in `packages/core/src/rules/` exports one `Rule`: `meta` (WCAG, EN 301 549, who is affected, what they experience, three fixes) and `check({ screen, device, raster })`. Read `state-not-exposed.ts` first. It is the shortest complete one.

| Rule | Severity | Evidence it uses | What it deliberately leaves alone |
|---|---|---|---|
| `name/interactive-missing` | error | name, interactive | — |
| `name/image-missing` | error | role image, exposed | images TalkBack skips (decoration vs content would be a guess) |
| `input/missing-label` | error | textfield, `labeledBy`, hint | placeholder-only labels, which need typing (ADR-010) |
| `state/not-exposed` | error | role promises state, `checked` null | home-made toggles with no role, which need a tap (M3) |
| `focus/unreachable` | error | interactive but not exposed | controls inside an accessible row; Compose `hideFromAccessibility()` |
| `text/scaling-truncation` | error | 200% capture, hidden characters | text clipped by a fixed-height box (ADR-011) |
| `contrast/text` | error | screenshot pixels, text size | busy backgrounds (the estimator returns null) |
| `target/size` | warning | dp size, touch area | where two Compose touch areas meet; React Native `hitSlop` (ADR-007) |
| `name/duplicate` | warning | same spoken name, same window | a row and the control inside it |

The rule in the last column of every row is the same: **a false alarm is a bug**. Each rule is silent where it cannot be sure, and the miss is published in the bench instead of hidden.

## 4. Pragu Bench: how we know

`bench/` is ground truth. Every fixture screen has `expected.json`, which labels each seeded barrier and each correct twin by element. `pnpm bench` re-runs the rules on committed recordings (`bench/recordings/`). It computes precision, recall, F1 and MCC per rule (`metrics.ts`) and fails CI when anything differs from `bench/results.json` (`gate.ts`).

The CI e2e job (`.github/workflows/e2e.yml`) records every screen again on a fresh emulator and must reproduce the same results. That makes it the end-to-end test of the agent, the capturer and the model together.

Current numbers: `docs/STATUS.md`. All error rules have precision 1.00 on 8 screens. That is a small sample: an early signal, not a quality claim.

## 5. Report v1

`packages/report/src/index.ts` contains typed template functions and no framework (ADR-003 amendment). Things to look at:

- `placeSigns`: each numbered sign on the screenshot carries its measurement and is moved until no two overlap.
- `theme.ts`: every colour is a token, and a test checks contrast in both themes.
- `renderTranscript`: the screen-reader transcript (`core/src/transcript.ts`) with finding numbers on the lines they affect. It is labelled as an approximation.
- the "What these checks cannot tell you" section, which keeps the report honest.

## 6. Where M1 stands against its plan

Done: work packages 1, 2, 3, 6 (in part), 7 (except SARIF), 8, 9, and 5 (except the TalkBack check).

Not done, or done differently:

- **Exit criterion "20 screens within budget":** CI scans 8 screens at two text sizes (16 scans, slowest 7.6 s against a 20 s budget). There are not yet 20 distinct screens. Either add screens or agree that 16 scans count.
- **Transcript vs real TalkBack:** not verified (STATUS, 2026-10-29).
- **Report:** one screen view only. The plan's rule view, diff view, filtering, `pnpm design` playground and axe-core check in CI are not built. Preact and Vite were dropped with your approval (ADR-003 amendment).
- **Owner tasks:** SARIF, `target/size` platform tier, `name/generic`, `contrast/non-text` (yours, briefs ready).
- `focus/order`, `name/role-in-label` and `structure/no-headings` moved to M2, as the plan allowed.

## 7. Three interview questions

Answer them out loud, without the code open, then check against the notes.

1. **"Why does `target/size` treat a 40 dp Compose button differently from a 40 dp React Native button?"**
2. **"A rule fires on a twin in a fixture. Walk me through what you do, and what you must not do."**
3. **"Your agent runs with UiAutomation on someone's phone. What stops another app from using it, and what stops it leaking data?"**

<details>
<summary>What a good answer covers</summary>

1. Compose reports a clickable's touch area, which it enlarges to 48 dp where there is room. React Native reports the drawn size, and Pragu cannot see `hitSlop` yet. So `boundsAreTouchArea` changes what the bounds mean, and where two Compose touch areas meet the rule stays silent. React Native targets may be false alarms when `hitSlop` exists, which is why the rule is a warning until M4 (ADR-007, ADR-009).
2. That is a false positive and counts as a bug. Find which model field misled the rule, and fix it in the model or the rule *generally*: never special-case the fixture's id, and never relabel the twin to make the number go up. Add a negative unit test for the case, re-run `pnpm bench`, and accept with `bench:update` only when the diff is the improvement you expected. If no general fix exists, prefer silence (or lower confidence) and publish the miss.
3. The socket is an abstract Unix socket that accepts only the shell or root user (`isTrustedPeer`), so normal apps cannot connect. The agent has no INTERNET permission (enforced in the release build check), times out when idle, and answers only over adb. Screenshots and trees go to the developer's machine and nowhere else. The threat model is `docs/security/`. The remaining risk is reports with screenshots ending up in synced folders (ROADMAP idea).

</details>

## 8. Your owner tasks

In any order. Each brief has the test checklist as `it.todo` entries:

- SARIF writer: `docs/plans/owner-task-sarif.md`
- `target/size` platform tier, `name/generic`, `contrast/non-text`: `docs/plans/owner-tasks-rules.md`

Open a PR per task; I review against the brief and the bench.

# Pragu: technical design (M0)

Status: describes what the walking skeleton implements, and what is deliberately left for later. Decisions live in `docs/adr/`.

## Architecture

```
Device / emulator                         Developer machine or CI
┌───────────────────────────┐   adb      ┌──────────────────────────────────────────────┐
│ dev.pragu.agent (APK)     │  forward   │ pragu CLI (Node)                              │
│  Instrumentation          │◄──────────►│  adb orchestration → agent session            │
│  UiAutomation: tree + PNG │  abstract  │      │                                        │
│  AgentServer (uid 0/2000) │  socket    │      ▼                                        │
└───────────────────────────┘            │ @pragu/core: parse → normalise (PAM) → rules  │
                                         │      │                → issues → summary      │
                                         │      ▼                                        │
                                         │ @pragu/report: one offline HTML · JSON result │
                                         └──────────────────────────────────────────────┘
```

## `pragu scan --app <id>`: sequence

1. Find adb (`ANDROID_HOME/platform-tools`, else PATH) and select exactly one ready device. Otherwise exit 2 or 3, with the fix.
2. Optionally `adb install -r <app.apk>`. Always `adb install -r` the agent, then `am force-stop` any old agent.
3. Launch the app with `monkey -p <id> -c android.intent.category.LAUNCHER 1`.
4. `am instrument -w -e socket pragu-<random> dev.pragu.agent/.PraguInstrumentation`, then `adb forward tcp:0 localabstract:pragu-<random>`.
5. Connect, and retry `hello` until it answers. adb accepts the connection before the agent listens.
6. `capture {packageName, timeoutMs}`. The agent polls until the app's topmost window is on screen and every window is the same twice, with content in the app. It returns all windows as JSON (protocol 2: trees only for the app's own windows) and the screenshot as PNG.
7. `shutdown`, then remove the forward.
8. Validate the capture (`parseAndroidCapture`), normalise it to PAM, decode the PNG, run the rules, and write `pragu-result.json`, `pragu-report.html` and the raw capture.
9. Exit 0, or 1 when issues reach `--fail-on` (default: error).

`--from-capture` re-runs steps 8–9 from a saved capture. Tests use it to cover the whole pipeline without a device.

## Pragu Accessibility Model (PAM)

Defined in `packages/core/src/model.ts`. It is platform-neutral, so rules never see Android types.

- **Node:** normalised `role` plus `platformRole`, accessible `name`, `text`, `hint`, `resourceId`, bounds in px and dp, `boundsAreTouchArea` (Compose reports touch areas, ADR-009), `interactive`, `exposedToAssistiveTech`, `visible`, `obscured`, `inWebView`, `window`, `enabled`, `textSizeDp`. Ids are tree paths whose first segment numbers the app's windows from the bottom (`0.3.1`, `1.0`).
- **Window:** kind (`app`, `keyboard`, `system`, `other-app`, `overlay`), title, bounds, and whether it is the app's topmost (`foreground`) window.
- **Screen:** app id, name, screenshot reference, windows bottom first, nodes depth-first per app window.
- **What rules judge** (ADR-008): visible elements of the app's topmost window, not fully covered by another window, and not web content. Contrast also skips partly covered (`obscured`) elements.
- **Issue:** rule metadata copied in (WCAG/EN mappings, who is affected, fix guidance), evidence, confidence, fingerprint (ADR-004).

## Android specifics, in `android.ts`

- **Role:** a role description from React Native or Compose wins, then the heading flag, then the class name (most specific first).
- **Accessible name, approximating TalkBack:**
  - content description first, then the node's own text;
  - a text field is named by its hint, because its text is the value;
  - a focusable container borrows the labels of descendants that do not get their own focus stop. It reads through views hidden from accessibility to their children.
- **Interactive:** clickable, long-clickable, checkable, editable, has a click action, or has an interactive role.

## The three M0 rules

| Rule | Check | Notes |
|---|---|---|
| `name/interactive-missing` | Interactive, visible, exposed, not a text field, and no accessible name | Text fields belong to `input/missing-label` (M1) |
| `contrast/text` | Per visible text node, estimate text and background colours from the screenshot. 4.5:1 for normal text, 3:1 for large | Background is the dominant colour. Text is the frequent colour with the highest contrast against it, so anti-aliased edges never win. A busy background returns nothing, to avoid false alarms. Text size from `ExtraRenderingInfo` (API 30+). Unknown size gives medium confidence. |
| `target/size` | Interactive targets under 24×24 dp, unless WCAG's spacing exception applies | The exception: a 24 dp circle around the target touches no other target and no other undersized target's circle. Parent and child targets are not counted as neighbours. Silent where two Compose touch areas meet, because the real split is invisible (ADR-009). Medium confidence, and a warning rather than an error, because `hitSlop` and `TouchDelegate` are invisible to the tree (ADR-007). |

### WCAG CSS pixels in dp and pt

WCAG 2.5.8 asks for 24 × 24 CSS pixels. A CSS pixel is a reference unit, not a device pixel. Mobile browsers define one CSS pixel as one density-independent unit: Chrome on Android sets the device-pixel ratio to density/160, so 1 CSS px = 1 dp, and Safari on iOS maps 1 CSS px to 1 pt. So 24 CSS px is 24 dp on Android and 24 pt on iOS, the size the same content would have in the phone's browser. Platform guidance is larger, 48 dp (Android) and 44 pt (iOS), and Pragu reports it one level below the WCAG tier (ADR-007).

## Errors and exit codes

Every user-facing error is a `PraguError` with what happened and the exact fix. Exit codes: 0 OK, 1 issues at the threshold, 2 usage, 3 environment. An unexpected exception prints the stack and asks for a bug report.

## Not done yet

Scrolling and off-screen content, flows and crawling, baselines, SARIF, config, scoring, transcript, iOS. See `docs/plans/m1.md` and `ROADMAP.md`. Windows, dialogs, the keyboard and WebViews arrived in M1 (ADR-008).

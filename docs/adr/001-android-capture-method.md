# ADR-001: Capture Android screens with Instrumentation + UiAutomation

- Status: Accepted for M0–M2. Revisit in the M3 navigation RFC.
- Date: 2026-10-27

## Context

Pragu needs each screen's accessibility tree (what TalkBack sees) and a screenshot, from any app, on an emulator or a phone, without changing the app's code. Android offers two ways in:

| | Instrumentation + `UiAutomation` | `AccessibilityService` |
|---|---|---|
| Device setup | None. `adb shell am instrument` starts it. | Must be enabled in Settings, or via `adb shell settings put secure enabled_accessibility_services …`. Android 13+ restricts enabling sideloaded services from the UI. |
| Reads other apps | Yes, the whole screen | Yes, the whole screen |
| Screenshot | `UiAutomation.takeScreenshot()`, all supported APIs | `takeScreenshot()`, API 30+ only |
| Lifetime | While the instrumentation runs; started and stopped by the CLI | Always on once enabled, also while a person explores the app |
| CI | Fits naturally: the CLI drives everything over adb | Needs an extra provisioning step per device |
| Main limit | Only one `UiAutomation` connection at a time. Maestro, Appium and UiAutomator tests hold their own. | Runs alongside test frameworks, but `UiAutomation` suppresses services unless created with `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` |

## Decision

Use **Instrumentation + `UiAutomation`** for M0–M2, where scans are started by the CLI.

- One APK (`dev.pragu.agent`) declares `<instrumentation targetPackage="dev.pragu.agent">`. `getUiAutomation(FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)` keeps TalkBack running while Pragu reads the screen.
- Service flags `FLAG_INCLUDE_NOT_IMPORTANT_VIEWS`, `FLAG_REPORT_VIEW_IDS` and `FLAG_RETRIEVE_INTERACTIVE_WINDOWS` expose hidden interactive views (for `focus/unreachable`), resource ids (React Native `testID`s) and window titles.
- Capture waits until the tree is identical twice in a row and has content. React Native shows an empty root while its JS bundle loads, so "UI idle" alone would capture a blank screen.
- The snapshot and serialisation code (`NodeSnapshot`, `Capture`) does not depend on where the root node comes from. An `AccessibilityService` front-end can reuse it.

## Consequences

- No setup on the device and nothing in the app. The 60-second promise holds.
- Pragu cannot capture while another tool holds `UiAutomation`, such as Maestro, Appium or Espresso tests that use UiAutomator. Flow integration in M3 has to interleave captures with test steps, or add an `AccessibilityService` capture mode. The M3 RFC decides.
- Deviation from the brief: only the `UiAutomation` path was prototyped in M0, as the walking skeleton. The `AccessibilityService` prototype moves to the M3 RFC, where its one real advantage, living alongside test runs, matters.

## Evidence

Walking skeleton on the `medium_phone` emulator (API 36, 1080×2400, 420 dpi), scanning `fixtures/rn-shop`: see `docs/STATUS.md` for the measured capture time and node count.

## Sources

- `UiAutomation`: https://developer.android.com/reference/android/app/UiAutomation
- `Instrumentation.getUiAutomation(int)`: https://developer.android.com/reference/android/app/Instrumentation#getUiAutomation(int)
- `AccessibilityService.takeScreenshot`: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService#takeScreenshot(int,%20java.util.concurrent.Executor,%20android.accessibilityservice.AccessibilityService.TakeScreenshotCallback)

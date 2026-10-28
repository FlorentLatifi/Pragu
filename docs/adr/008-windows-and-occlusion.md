# ADR-008: Capture every window; check only what the user can act on

- Status: Accepted
- Date: 2026-10-28

## Context

Protocol 1 captured one tree: `rootInActiveWindow`. That misses or misjudges common states:

- **Dialogs and modals** (React Native `Modal`, `AlertDialog`, bottom sheets) live in their own window.
- **The keyboard** is a separate window that covers part of the app. Elements under it still report themselves visible, and the contrast rule would sample the keyboard's pixels.
- **System UI and other apps** (status bar, notification shade, a permission prompt) can cover the app.

## Decision

**Protocol 2.** The agent reports every window from `UiAutomation.getWindows()`, bottom first: its type, layer, title, bounds, and active/focused flags. Only the scanned app's own windows carry an element tree. The keyboard, system UI and other apps are rectangles only, so their content (notifications, other apps' screens) never leaves the device.

**What the rules judge**, decided in the core when it normalises a capture:

1. Only the app's **topmost window** is checked. With a dialog open, the content behind it is not what the user can act on, and a dimming scrim would fake low contrast. Elements of lower windows are kept, but marked not visible. Measured on API 36: with a full-screen React Native `Modal` open, Android itself leaves the covered activity window out of `getWindows()`, so the capture holds only the dialog. This rule is the safety net for windows Android does list, such as card-sized dialogs or popups.
2. In that window, an element **fully covered** by a window above (keyboard, system panel, another app) is not visible. A **partly covered** element is visible but `obscured`, and the contrast rule skips it, because some of its pixels belong to the covering window.
3. Accessibility and magnification **overlays are see-through**: they never hide what is below them.
4. Everything inside a **WebView** is web content (`inWebView`). The rules skip it; web tools such as axe-core own it (a brief non-goal).

The report says so on the screen when a dialog, the keyboard or web content limited what was checked.

## Evidence (emulator, API 36)

- **Dialog** (`rnshop://cart?dialog=remove`): windows = the dialog (17 nodes) and the status bar (no tree). The bench finds the dialog's two barriers and none of the cart's three behind it.
- **Keyboard** (form screen, field focused, with `show_ime_with_hard_keyboard` temporarily on): windows = app, `input_method` at y 1517–2400 px (no tree), status bar. Full-screen containers under the keyboard were marked obscured; the report said the keyboard was open. The form is too short for any control to sit fully under the keyboard, so fully-covered elements are proven by unit tests, not on device.

## Consequences

- No false findings from dimmed backgrounds or keyboard pixels.
- **Report note gap:** because Android omits the window behind a full-screen modal, a capture with a `Modal` open shows one app window, so the report cannot say "a dialog was open". It does say so when Android lists more than one app window.
- **Known gap:** a small, non-modal popup over the app (e.g. autocomplete suggestions) also counts as the topmost window, so the still-usable content around it is not checked. That is a missed finding, never a false one. M3 flows revisit it with the navigation RFC.
- Node ids gain a window prefix: the app's windows are numbered from the bottom, so the first window's elements keep their protocol-1 ids (`0`, `0.3`). Fingerprints do not use ids, so baselines are unaffected.
- The result schema moves to 0.2.0 (`PamScreen.windows`, `PamNode.obscured`, `inWebView`, `window`).

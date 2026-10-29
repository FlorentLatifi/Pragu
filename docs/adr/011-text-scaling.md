# ADR-011: Check text at 200% on request, and report only the ellipsis

- Status: Accepted (Florent chose opt-in, 2026-10-29)
- Date: 2026-10-29

## Context

`text/scaling-truncation` (WCAG 1.4.4) needs the screen at 200% text. Android has no per-app setting for that, so Pragu has to change the device's system font scale, capture again, and put the setting back. That changes someone's device, even if only for seconds.

Experiments on both fixtures (React Native and Compose, Android 16 emulator) settled what a capture can show:

- **An ellipsis is visible.** Android lays out the characters an ellipsis hides with no width. At 200% the one-line seed had 3 (React Native) or 4 (Compose) such characters; at 100%, and in every twin, there were none.
- **Text cut off by a fixed-height box is not.** Android clips character positions to the visible area, so cut text and text that fits look the same. Comparing heights fails as well: since Android 14 font scaling is non-linear, so 28 sp headings grew only about 1.3 times at 200% while staying fully readable. A height rule flagged 9 such headings and glyphs as false alarms.
- React Native reported its text size unscaled at 200%, so size cannot help either.

## Decision

1. `pragu scan --check-font-scale` captures the screen a second time at font scale 2.0. It is opt-in: off unless asked. It reads the current setting first and always restores it, after success, after an error and on Ctrl+C. A device that never had the setting gets it deleted again rather than pinned to 1.0.
2. Protocol 4 adds `textCollapsedChars` to every text node: visible characters laid out with no width.
3. The rule reports text that has no ellipsis at the normal size, has one at 200%, and is fully on screen in both captures.
4. Text cut off by a container is a known miss, published in the bench.
5. If the app leaves the screen after the switch, the scan says so: it may have crashed, which is a barrier in itself.

## Consequences

- Most truncation in practice (`numberOfLines`, `maxLines`, `ellipsize`) is caught with high confidence; boxed text is not.
- Pragu Bench records every screen at both sizes. The recorder opens each screen fresh at 200% rather than switching a running app, which is quicker and more repeatable.
- Turning the check on by default waits until the bench shows it is safe and useful on more apps (ROADMAP).

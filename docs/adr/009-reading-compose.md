# ADR-009: Read Compose the way TalkBack does

- Status: Accepted
- Date: 2026-10-28

## Context

The first scan of `fixtures/android-compose` (Compose 1.12 from BOM 2026.09.00, Android 16 emulator) reported 12 issues on two screens. Five were real. The rest came from three ways Compose exposes accessibility that Views and React Native do not:

1. **Role children.** `Button`, `IconButton`, `Checkbox` and `Switch` put their role on a child node, not on the clickable node. An `IconButton` labelled "Back" arrives as a clickable `android.view.View` with two children: the icon (content description "Back") and an `android.widget.Button` with no text that is neither clickable nor focusable. A toggleable row's child carries role description "Switch". TalkBack never stops on these children; it reads them as part of the parent ("Back, Button"). Pragu counted every role child as a control without a name: six false alarms.
2. **No text size.** Compose nodes carry no `ExtraRenderingInfo`, so text size is unknown. A 28 sp heading at 3.2:1, which passes as large text, was held to 4.5:1.
3. **Touch areas.** Compose reports each clickable's *touch area* as its bounds, enlarged to 48 dp. Where two areas overlap, the element drawn later keeps the overlap. Two 20 dp icons 2 dp apart came back as 22×48 and 48×48 dp, so the first looked too small. Held presses on the emulator settled what the real targets are. A press 7.6 dp left of the first icon activates it. A press inside the first icon, within the second icon's reported area, also activates the first. So Compose sends a touch to the nearer element, and both icons accept touches far beyond 24 dp. Five 16 dp stars that touch came back with every reported area shifted one star to the left. Presses showed that a touch inside a star always goes to that star. The middle three therefore accept touches over 16 dp only, while the end stars gain the free side's enlargement.

## Decision

1. **A control role counts only where TalkBack stops.** A node is interactive through its role only if it is clickable, focusable, screen-reader-focusable or checkable. A clickable container with no role of its own takes the first control role among the children it reads out. This mirrors TalkBack's reading rules rather than special-casing Compose, so it holds for any toolkit that composes controls this way.
2. **Unknown text size is bounded by the element's height.** Text is never taller than the element that holds it, so the height is the largest the text can be. The usual thresholds apply to that bound, with medium confidence. Only text too short to be large is held to 4.5:1. Below 3:1 text fails at every size, so it is always reported.
3. **Pragu stays silent where Compose touch areas meet.** The adapter marks the bounds of interactive nodes under a `ComposeView` as touch areas (`PamNode.boundsAreTouchArea`, result schema 0.3.0). `target/size` reports nothing for a target whose touch area meets another touch area: the reported sizes there are bookkeeping, and the real split is invisible.

## Alternatives considered

- **Guess the text size as height ÷ 1.33**, the line-height ratio of most Material 3 styles. It would catch more pale body text, but it is a guess, and it misjudges bold text between 18.66 and 24 dp. Rejected: a false alarm is a bug.
- **Read character bounds** (`EXTRA_DATA_TEXT_CHARACTER_LOCATION_KEY`) to get each line's height. That bounds multi-line text better but still not the font size, and it needs a protocol change. Possible later, if the bench shows missed contrast on Compose.
- **Skip target size on Compose altogether.** Simpler, but it would hide that this is a choice, and Pragu can still judge targets whose areas do not meet.
- **Rebuild the real touch areas** by giving each point to the nearest element. That needs each element's drawn bounds, which Compose does not report for a plain clickable.

## Consequences

- Across both fixtures (6 screens) the two error rules have no false positives. `target/size` publishes the three middle stars as misses: crowded small targets on Compose are a known blind spot.
- On Compose, pale text between 3:1 and 4.5:1 goes unreported when its line is 18.66 dp or taller, which covers most Material body styles (20–24 dp lines). Pale text below 3:1 is still found.
- These rules describe Compose 1.12. A Compose update can change the tree, so the fixture's recordings are refreshed after one, and the bench shows whether these assumptions still hold.

# Compose shop (fixture)

A small Jetpack Compose app for Pragu Bench. Each screen seeds accessibility barriers next to correct twins, so the bench measures both missed barriers and false alarms on Compose, not only on React Native (`fixtures/rn-shop`).

| Deep link | What it shows |
|---|---|
| `composeshop://settings` | An `IconButton` whose `Icon` has `contentDescription = null`; a `Switch` whose label is not connected to it; pale text; touching 16 dp stars. Twins: a labelled `IconButton`, a toggleable row that names its `Switch`, readable and large text, and two 20 dp icons that Compose enlarges enough. |
| `composeshop://checkout` | A home-made checkbox with no name, role or state; a text field labelled only by its placeholder; a field whose visible label is not connected to it; a `clickable(role = Role.Checkbox)` row with no state; a button hidden with `hideFromAccessibility()`. Twins: a toggleable checkbox row, a labelled field, a button, and a disabled button. |

Ground truth is in `expected.json`, keyed by `testTag`. `testTagsAsResourceId = true` exposes each tag as the element's resource id.

## Build and record

```bash
pnpm fixture:build android-compose   # JDK 17 and ANDROID_HOME; about 1.5 min the first time
pnpm bench:record                    # every fixture on the running emulator; add --only android-compose
```

## What Compose 1.12 taught the bench

Compose exposes accessibility differently from Views and React Native, and the first scan of this app produced six false alarms. Each one led to a general fix:

- **Role children.** `Button`, `Checkbox` and `Switch` put their role on a child node under the clickable one. TalkBack reads that child as part of its parent, so a role alone no longer makes a node a control. A clickable container takes the role it reads out.
- **No text size.** Compose does not report text size. Pragu now uses the element's height as the largest the text can be, so text that might be large is held to 3:1.
- **Touch areas.** Compose reports each clickable's touch area enlarged to 48 dp, and gives the overlap of two areas to the element drawn later, although a touch goes to the nearer element. Held presses on the emulator confirmed that the 20 dp icons accept touches far beyond their drawn size. Where two touch areas meet, Pragu cannot tell the real split and stays silent. That is why the touching stars are a known miss.

Versions: Compose BOM 2026.09.00 (Compose 1.12), compileSdk 37, targetSdk 36, minSdk 26. A Compose update can change the accessibility tree, so re-record the bench after one.

---
title: Pragu
description: Find the accessibility barriers in your mobile app before your users hit them.
---

**Pragu finds accessibility barriers in your Android app, shows who they hurt, and tells you how to fix them in your own code.** _Prag_ is Albanian for threshold: the step a wheelchair can't climb.

:::caution[Pre-release]
Pragu is not on npm yet. Everything on this site runs from source today; `npx pragu` arrives with v0.1.
:::

One scan of a React Native shop's cart screen, from a recording:

```text
$ pragu scan --from-capture bench/recordings/rn-shop/cart.json
5 barriers: 4 errors, 1 warning, 0 info
  1. Warning: Touch target is too small · seed-tiny-dismiss (WCAG 2.5.8)
  2. Error: Interactive element has no accessible name · seed-unlabeled-remove (WCAG 4.1.2)
  3. Error: Text contrast is too low · seed-low-contrast (WCAG 1.4.3)
  4. Error: Control does not expose its state · seed-stateless-checkbox (WCAG 4.1.2)
  5. Error: Control is hidden from assistive technology · seed-hidden-button (WCAG 2.1.1, 4.1.2)
```

What you get:

- **No changes to your app.** Pragu reads what TalkBack sees, plus a screenshot, from an emulator or a phone.
- **Who it hurts, and the fix.** Every issue names the people it affects, what they experience, and the change in React Native, Jetpack Compose or Android Views.
- **One offline report** with numbered signs on the screenshot and what a screen reader would say, line by line.
- **Pull requests that only show what they add**, through a GitHub Action, with screenshots redacted on public repositories.
- **Honest numbers.** Every rule's precision is measured on labelled screens and published, counts included.

Start with [getting started](/Pragu/getting-started/), or read [what automated checks cannot tell you](/Pragu/concepts/what-checks-miss/) first.

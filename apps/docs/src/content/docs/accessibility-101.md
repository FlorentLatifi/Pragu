---
title: Accessibility 101 for mobile developers
description: What TalkBack users, low-vision users and others need from your app.
---

About 1.3 billion people, one in six, live with a significant disability ([WHO](https://www.who.int/news-room/fact-sheets/detail/disability-and-health)). Many of them use your app with these tools:

- **TalkBack**, Android's screen reader, reads each element aloud as the person swipes: its name, its role, its state. "Remove item, Button". With no name, it says only "Button".
- **Large text.** People raise the system font size, often to 200%. Text that cannot grow, or gets cut off, is lost.
- **Low vision and bright light** make pale text unreadable. WCAG asks for a contrast of 4.5:1 for normal text.
- **Motor impairments** make small targets hard to hit. WCAG 2.2 asks for 24 × 24 CSS pixels, which is 24 dp on Android; Android's own guidance is 48 dp.
- **Switch and voice control** move through the same accessibility tree as TalkBack.

Four habits prevent most barriers Pragu finds:

1. Give every control that has no visible text a name: `accessibilityLabel`, `contentDescription`.
2. Give custom controls a role and a state.
3. Let text wrap and grow; avoid fixed heights around text.
4. Keep touch targets at least 48 dp and text contrast at 4.5:1.

Then try your own app with TalkBack for ten minutes. It is the fastest way to understand all of this.

---
title: What automated checks cannot tell you
description: Pragu finds some barriers, not all. What still needs a person.
---

Pragu runs automated checks. It finds some barriers, never all, and it never certifies compliance with WCAG, the European Accessibility Act or any law.

It cannot judge:

- whether a name makes sense in context: "Button 3" is named, and useless;
- whether a whole flow is understandable, or recoverable after a mistake;
- gestures, timing, motion, sound and captions;
- how the app works with every assistive technology, from switch access to voice control.

It only checks what is on the screens it opens: content below the fold is not scrolled to yet, and the report says so. A screen that blocks screenshots (`FLAG_SECURE`) is checked without its pixels, so contrast is not checked there.

**Test with TalkBack on, at 200% text size, and with people who use assistive technology every day.**

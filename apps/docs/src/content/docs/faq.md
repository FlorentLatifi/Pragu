---
title: FAQ
description: Short answers.
---

**Does Pragu send anything anywhere?** No. It has no telemetry, its agent has no network permission, and reports stay where you write them.

**iOS?** Planned: a spike on GitHub's macOS runners comes after the Android release.

**Flutter?** Flutter apps expose their semantics to Android accessibility, so Pragu reads them today; Flutter-specific fixes come with a Flutter test app.

**Does a clean report mean my app is accessible?** No. See [what automated checks cannot tell you](/Pragu/concepts/what-checks-miss/).

**Why is `target/size` only a warning?** React Native's `hitSlop` enlarges touch areas invisibly to accessibility tools, so Pragu can be wrong about the size. It stays a warning until Pragu can see it.

**Can Pragu tap through my app on its own?** Not yet. A careful crawler, which never taps pay, delete or log out, is planned.

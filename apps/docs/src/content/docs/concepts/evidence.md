---
title: How we measure Pragu
description: Pragu Bench, and why its numbers are published with their counts.
---

A false alarm is a bug: it teaches people to ignore the tool. So every rule is measured on screens where the truth is known, and the results are published, never rounded up.

- **Seeded fixtures:** a React Native and a Jetpack Compose app with planted barriers next to correct twins. CI re-scores every rule on every change, and once on a real emulator, and fails if anything moves.
- **Real apps (coming):** open-source apps labelled blind, before anyone looks at Pragu's output, with a held-out half scored only for releases.

An error rule must reach precision 0.90 to fail builds; below that it is a warning. The current table is in the repository, under `docs/bench/results.md`.

The sample is small today, so read the numbers as an early signal.

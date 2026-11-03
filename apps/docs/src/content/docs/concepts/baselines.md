---
title: Baselines
description: Adopt Pragu on an existing app without fixing everything first.
---

An existing app has barriers already. A baseline accepts them, so only new ones fail the build:

```bash
pragu scan --app com.example.shop --fail-on never
pragu baseline create --from pragu-report/pragu-result.json
pragu scan --app com.example.shop --baseline pragu-baseline.json
```

Commit `pragu-baseline.json`. Later scans mark each issue as new or already accepted, and list what was fixed since. `pragu baseline update` accepts the current state again.

Issues are recognised by a fingerprint of the rule, the screen's name and the element: its testID or resource id when it has one, else its role and name, else its place in the tree. Moving an element, changing other text or adding items to a list keeps the fingerprint.

Issues you decided to live with can also be ignored in `pragu.config.ts`, with a required reason; reports count them, so the decision stays visible.

---
title: Configuration
description: Every setting in pragu.config.ts.
---

```ts
import { defineConfig } from 'pragu';

export default defineConfig({
  app: 'com.example.shop',
  screens: [{ name: 'Cart', deepLink: 'shop://cart', waitFor: 'cart-title' }],
  out: 'pragu-report',
  failOn: 'error',
  checkFontScale: false,
  baseline: 'pragu-baseline.json',
  redact: false,
  rules: { 'target/size': 'error', 'structure/no-headings': 'off' },
  ignore: [{ rule: 'contrast/text', resourceId: 'promo-banner', reason: 'Brand colours; fix tracked in #123' }],
});
```

| Setting | Meaning |
|---|---|
| `app` | Android application id |
| `screens` | Screens to open, each `{ name, deepLink?, waitFor? }`. Names must be unique: baselines tell screens apart by name |
| `out` | Report folder |
| `failOn` | `error`, `warning`, `info` or `never` |
| `checkFontScale` | Also capture at 200% text |
| `baseline` | Baseline file |
| `redact` | Reports for sharing (see [pull requests on GitHub](/Pragu/guides/ci/)) |
| `rules` | Turn a rule `off` or change its severity |
| `ignore` | Issues to live with: any of `rule`, `resourceId`, `screen`, and a required `reason` |

The file is read with Node's own type stripping (22.18+): plain TypeScript types work, enums do not. Unknown settings are errors, with the list of known ones.

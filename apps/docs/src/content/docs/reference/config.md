---
title: Configuration
description: Every setting in pragu.config.ts.
---

```ts
import type { PraguConfig } from 'pragu';

export default {
  app: 'com.example.shop',
  screens: [{ name: 'Cart', deepLink: 'shop://cart', waitFor: 'cart-title' }],
  out: 'pragu-report',
  failOn: 'error',
  checkFontScale: false,
  baseline: 'pragu-baseline.json',
  redact: false,
  rules: { 'target/size': 'error', 'structure/no-headings': 'off' },
  ignore: [{ rule: 'contrast/text', resourceId: 'promo-banner', reason: 'Brand colours; fix tracked in #123' }],
} satisfies PraguConfig;
```

With npx only, an editor may show "Cannot find module 'pragu'" on the type import; loading is unaffected, and `npm install --save-dev pragu` gives full typing.

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

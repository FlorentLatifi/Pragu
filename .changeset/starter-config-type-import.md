---
'pragu': patch
---

`pragu init` writes a starter config that imports its type only (`import type { PraguConfig } from 'pragu'` and `satisfies PraguConfig`), so `pragu doctor` and `pragu scan` work with `npx` alone, with no local install. Configs that import `defineConfig` keep working when `pragu` is installed. When a config cannot import `pragu`, the error now says so and how to fix it instead of blaming enums.

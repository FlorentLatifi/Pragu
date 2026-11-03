---
title: Getting started
description: Scan one screen of your app in a few minutes, from source.
---

## What you need

- Node 22.18 or newer, and pnpm 12
- The Android SDK, with `ANDROID_HOME` set, and an emulator or a phone with USB debugging
- JDK 17, to build Pragu's agent

## Build Pragu

```bash
git clone https://github.com/FlorentLatifi/Pragu.git
cd Pragu
pnpm install
pnpm build
pnpm agent:build
```

`pnpm pragu doctor` checks Node, adb, the device and the agent, and prints the exact fix for anything missing.

## Scan your app

Start your app on the emulator, then:

```bash
pnpm pragu scan --app com.example.shop
```

Pragu installs its small agent (no network permission, ever), launches the app, waits for the screen to settle, and writes `pragu-report/pragu-report.html` and `pragu-report/pragu-result.json`. Open the report in any browser; it works offline.

The command exits 1 when it finds errors, so a CI step fails. Warnings and info do not fail it unless you ask with `--fail-on warning`.

## Several screens

List them in `pragu.config.ts`, each with its deep link, and one scan opens and checks every one on a fresh start:

```ts
import { defineConfig } from 'pragu';

export default defineConfig({
  app: 'com.example.shop',
  screens: [
    { name: 'Cart', deepLink: 'shop://cart', waitFor: 'cart-title' },
    { name: 'Product', deepLink: 'shop://product/42' },
  ],
});
```

`waitFor` is a testID that appears once the screen has loaded, so a splash screen is never checked under the screen's name. `pnpm pragu init` writes a starter config.

## Next

- [React Native and Expo](/Pragu/guides/react-native/): deep links, testIDs and fixes
- [Pull requests on GitHub](/Pragu/guides/ci/)
- [Every rule](/Pragu/rules/name-interactive-missing/), with who it affects and how to fix it

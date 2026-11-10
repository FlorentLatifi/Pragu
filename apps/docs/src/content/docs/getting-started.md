---
title: Getting started
description: Install Pragu from npm and scan your Android app.
---

## What you need

- Node 22.18 or newer
- The Android SDK, with `ANDROID_HOME` set, and an emulator or a phone with USB debugging

## Install Pragu

Nothing to install first. In your project folder:

```bash
npx pragu init
npx pragu doctor
```

`pragu init` writes a starter `pragu.config.ts`; set `app` to your applicationId. `pragu doctor` checks Node, adb, the device and the agent, and prints the exact fix for anything missing. With no device connected, it prints this (real output, exit code 3):

```text
Pragu doctor
  OK       Node 26.12.1
  OK       Android Debug Bridge version 1.0.41 (...\platform-tools\adb.exe)
  PROBLEM  No Android device or emulator is connected.
           Fix: Start an emulator (emulator -avd <name>) or connect a phone with USB debugging on.
  OK       Agent APK found (...\pragu-agent.apk).
  OK       pragu.config.ts is valid.
1 problem to fix before scanning.
```

With npx only, an editor may show "Cannot find module 'pragu'" on the type import; loading is unaffected, and `npm install --save-dev pragu` gives full typing.

Building from source instead (to work on Pragu itself) needs JDK 17 and pnpm 12: clone `https://github.com/FlorentLatifi/Pragu.git`, then `pnpm install`, `pnpm build`, `pnpm agent:build`, and use `pnpm pragu` where this page says `npx pragu`.

## Scan your app

Start your app on the emulator, then (this step needs a device, so its output is not shown here; it was not run for this page):

```bash
npx pragu scan --app com.example.shop
```

Pragu installs its small agent (no network permission, ever), launches the app, waits for the screen to settle, and writes `pragu-report/pragu-report.html` and `pragu-report/pragu-result.json`. Open the report in any browser; it works offline.

The command exits 1 when it finds errors, so a CI step fails. Warnings and info do not fail it unless you ask with `--fail-on warning`.

## Several screens

List them in `pragu.config.ts`, each with its deep link, and one scan opens and checks every one on a fresh start:

```ts
import type { PraguConfig } from 'pragu';

export default {
  app: 'com.example.shop',
  screens: [
    { name: 'Cart', deepLink: 'shop://cart', waitFor: 'cart-title' },
    { name: 'Product', deepLink: 'shop://product/42' },
  ],
} satisfies PraguConfig;
```

`waitFor` is a testID that appears once the screen has loaded, so a splash screen is never checked under the screen's name. `npx pragu init` writes a starter config.

## On every pull request

Add this after your scan step to get one comment per pull request with only the barriers it adds. `npx pragu init --github` writes the whole workflow:

```yaml
permissions:
  contents: read
  pull-requests: write
  actions: read
  security-events: write

steps:
  # ... build your APK, then run "npx pragu scan" on an emulator ...
  - uses: FlorentLatifi/Pragu@v0
    if: always()
```

## Next

- [How Pragu compares](/Pragu/concepts/comparison/) with other accessibility tools
- [React Native and Expo](/Pragu/guides/react-native/): deep links, testIDs and fixes
- [Pull requests on GitHub](/Pragu/guides/ci/)
- [Every rule](/Pragu/rules/name-interactive-missing/), with who it affects and how to fix it

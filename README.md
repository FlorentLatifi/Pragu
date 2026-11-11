# Pragu

**Find the thresholds before your users hit them.**

Pragu finds accessibility barriers in your mobile app, shows who they hurt, and tells you how to fix them in your own code. *Prag* is Albanian for threshold: the step a wheelchair can't climb.

> **Status: 0.1.0 is on npm.** Android only (React Native, Jetpack Compose and Android Views apps). An early release: expect rough edges, and see the [roadmap](ROADMAP.md) for what is not there yet.

## What works today

![Pragu's report for a product screen: the screenshot with numbered yellow signs such as "1 no name", "3 1.53 : 1" and "6 20.2 × 19.8 dp" on the elements, next to the first issue, "Interactive element has no accessible name", with who it affects, what they experience and the fix in React Native, Jetpack Compose and Android Views.](docs/images/report.png)

The React Native fixture's cart screen, re-analysed from a capture recorded on an emulator (no device needed):

```text
$ pnpm pragu scan --from-capture bench/recordings/rn-shop/cart.json --out reports/rn-shop
Pragu scanned dev.pragu.fixtures.rnshop on sdk_gphone64_x86_64 (Android 16)
5 barriers: 4 errors, 1 warning, 0 info
  1. Warning: Touch target is too small · seed-tiny-dismiss (WCAG 2.5.8)
  2. Error: Interactive element has no accessible name · seed-unlabeled-remove (WCAG 4.1.2)
  3. Error: Text contrast is too low · seed-low-contrast (WCAG 1.4.3)
  4. Error: Control does not expose its state · seed-stateless-checkbox (WCAG 4.1.2)
  5. Error: Control is hidden from assistive technology · seed-hidden-button (WCAG 2.1.1, 4.1.2)
Report: reports/rn-shop/pragu-report.html
JSON:   reports/rn-shop/pragu-result.json
```

- `pragu scan` launches your app on an emulator or phone and reads what TalkBack would see, plus a screenshot. There are no changes to your app's code. List your screens with their deep links in `pragu.config.ts`, and one scan opens and checks each of them.
- Fourteen rules so far: missing names on controls and on images TalkBack stops on; text fields with no label; checkboxes, switches and radio buttons that never say whether they are on; controls that work by touch but are hidden from assistive technology; low text contrast (measured from the screenshot); text that an ellipsis cuts short at 200% text size (with `--check-font-scale`, which changes your device's font size for a few seconds and always restores it); touch targets below 24 dp (with WCAG's spacing exception; a warning until Pragu can see React Native's `hitSlop`); controls that share one name, like a row of "Remove" buttons (a warning); vague names such as "Button" or "ic_close" and icons under 3:1 contrast (warnings); and, as information, targets under Android's 48 dp, names that repeat their role ("Delete button") and long screens with no headings.
- [Pragu Bench](docs/bench/results.md) measures each rule's precision and recall on labelled screens, and CI re-checks it on every change.
- One offline HTML report with numbered markers on the screenshot. Every issue says who it affects, what they experience, and how to fix it in React Native, Jetpack Compose and Android Views.
- A versioned JSON result for machines.

## Quickstart from npm

You need Node 22.18+, `adb` (Android platform-tools) and an emulator or a phone with USB debugging.

```bash
npx pragu init
npx pragu doctor
npx pragu scan --app com.example.shop
```

`pragu init` writes the starter config. Set `app` to your applicationId and list the screens to check, each with its deep link:

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

With npx only, an editor may show "Cannot find module 'pragu'" on the type import; loading is unaffected, and `npm install --save-dev pragu` gives full typing.

`pragu doctor` checks Node, adb, the device and the agent. With no device connected, it prints this (real output, exit code 3):

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

`pragu scan` needs a running emulator or phone, so it is not shown with output here; it writes `pragu-report/pragu-report.html` and `pragu-report/pragu-result.json`, and exits 1 when it finds errors.

### On every pull request

`npx pragu init --github` writes `.github/workflows/pragu.yml`, which scans on an emulator and then runs Pragu's action. The action comments only the barriers a pull request adds ([ADR-014](docs/adr/014-github-integration.md)):

```yaml
permissions:
  contents: read
  pull-requests: write # the comment
  actions: read # the default branch's latest report
  security-events: write # SARIF in code scanning

steps:
  # ... build your APK, then run "npx pragu scan" on an emulator ...
  - uses: FlorentLatifi/Pragu@v0
    if: always()
```

How Pragu differs from other tools: [comparison](https://florentlatifi.github.io/Pragu/concepts/comparison/).

## Run it from source

You need Node 22.18+, pnpm 12, JDK 17, the Android SDK (`ANDROID_HOME`) and an emulator or a phone with USB debugging.

```bash
pnpm install
pnpm build
pnpm agent:build
pnpm fixture:build
pnpm fixture:scan
```

## What automated checks cannot tell you

Pragu runs automated checks. It finds some barriers, not all, and it never certifies compliance. It cannot judge:

- whether a name makes sense in context;
- whether a complex flow is understandable;
- how the app behaves with every assistive technology.

Test with TalkBack, at 200% text size, and with real users.

## Roadmap and docs

- **Docs site:** https://florentlatifi.github.io/Pragu/ (getting started, rules, how Pragu compares)
- [Founding brief](docs/00-founding-brief.md) · [Product requirements](docs/prd.md) · [Technical design](docs/design/technical-design.md)
- [Decision register](docs/decisions.md) · [ADRs](docs/adr/) · [Threat model](docs/security/threat-model.md) · [Test strategy](docs/testing/strategy.md)
- [Status](docs/STATUS.md) · [M1 plan](docs/plans/m1.md) · [M2 plan](docs/plans/m2.md) · [Roadmap](ROADMAP.md)

## License

[Apache-2.0](LICENSE). Contributions use the [Developer Certificate of Origin](CONTRIBUTING.md).

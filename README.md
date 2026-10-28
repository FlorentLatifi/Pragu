# Pragu

**Find the thresholds before your users hit them.**

Pragu finds accessibility barriers in your mobile app, shows who they hurt, and tells you how to fix them in your own code. *Prag* is Albanian for threshold: the step a wheelchair can't climb.

> **Status: pre-alpha (M0 approved, milestone M1 in progress).** Android only. The walking skeleton works end to end on an emulator. Nothing is published to npm yet.

## What works today

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

- `pragu scan` launches your app on an emulator or phone and reads what TalkBack would see, plus a screenshot. There are no changes to your app's code.
- Seven rules so far: missing names on controls and on images TalkBack stops on; text fields with no label; checkboxes, switches and radio buttons that never say whether they are on; controls that work by touch but are hidden from assistive technology; low text contrast (measured from the screenshot); and touch targets below 24 dp (with WCAG's spacing exception; a warning until Pragu can see React Native's `hitSlop`).
- [Pragu Bench](docs/bench/results.md) measures each rule's precision and recall on labelled screens, and CI re-checks it on every change.
- One offline HTML report with numbered markers on the screenshot. Every issue says who it affects, what they experience, and how to fix it in React Native, Jetpack Compose and Android Views.
- A versioned JSON result for machines.

## Run it from source

You need Node 22.13+, pnpm 12, JDK 17, the Android SDK (`ANDROID_HOME`) and an emulator or a phone with USB debugging.

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

- [Founding brief](docs/00-founding-brief.md) · [Product requirements](docs/prd.md) · [Technical design](docs/design/technical-design.md)
- [Decisions (ADRs)](docs/adr/) · [Threat model](docs/security/threat-model.md) · [Test strategy](docs/testing/strategy.md)
- [Status](docs/STATUS.md) · [M1 plan](docs/plans/m1.md) · [Roadmap](ROADMAP.md)

## License

[Apache-2.0](LICENSE). Contributions use the [Developer Certificate of Origin](CONTRIBUTING.md).

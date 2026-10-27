# Pragu: product requirements (v0.1)

Status: draft for M0 approval · Owner: Florent Latifi · Last updated: 2026-10-27

## Problem

Mobile teams ship accessibility barriers they never see. They do not use their apps with a screen reader, at 200% text size, or with low vision, and the barriers they ship lock people out:

- About **1.3 billion people, 16% of the world**, live with a significant disability ([WHO, 2023](https://www.who.int/news-room/fact-sheets/detail/disability-and-health)).
- In an analysis of **10,408 Android apps**, "more than 77% apps have issues of missing labels". A blind TalkBack user then hears only "button" and cannot continue ([Chen et al., ICSE 2020](https://arxiv.org/abs/2003.00380)).

Regulation now applies to mobile apps:

- **EU:** the European Accessibility Act has applied since 28 June 2025. It covers services such as e-commerce and consumer banking, including their mobile apps ([Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj)).
- **US:** the ADA Title II rule requires state and local governments' web content and mobile apps to meet WCAG 2.1 AA. After a one-year extension, the deadlines are 26 April 2027 for entities serving 50,000 people or more, and 26 April 2028 for smaller ones ([Federal Register 2026-07663](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web)).

The open-source gap: Microsoft's Accessibility Insights for Android is no longer available and gets no updates ([release notes](https://www.accessibilityinsights.io/docs/android/reference/releases/)). Google's Accessibility Test Framework (Apache-2.0) and Apple's `performAccessibilityAudit()` are building blocks, not a CI product. Commercial tools exist (Deque axe DevTools Mobile, BrowserStack App Accessibility). No open tool covers both platforms, any test framework, CI and a shareable report together. Competitors must be re-checked before launch.

## Users and their job

1. **React Native / Expo developers (primary):** "Tell me in my pull request which barrier I just added, who it hurts, and the line to change."
2. **QA engineers with Maestro, Detox or Appium flows:** "Audit every screen my tests already visit."
3. **Engineering leads and compliance teams:** "Show evidence of automated checks for EAA and ADA work, honestly scoped."

First design partners: Prishtina software companies building apps for EU clients.

## v0.1 scope (M2)

- `pragu scan` on Android (emulator or phone) without changing the app's code, plus `init`, `doctor`, `report`, `baseline`, `rules`.
- The 14 initial rules, each with WCAG 2.2 and EN 301 549 mappings, who is affected, what they experience, and React Native, Compose and Views fixes. "Error" rules ship only when their measured precision is at least 0.90.
- One offline HTML report: screenshot callouts, screen-reader transcript, rule and diff views, light and dark themes, prints to PDF. Plus JSON (versioned schema) and SARIF 2.1.0.
- A GitHub Action with a short PR comment listing only new barriers. Baselines, so existing apps adopt it gradually.
- Pragu Bench: labelled fixtures with precision, recall, F1 and MCC per rule, published.

## Non-goals (v0.x)

Web accessibility (axe-core owns it), accounts or servers, legal certification, manual-audit workflows. iOS is planned (M3+), but needs a Mac or macOS CI.

## Principles that drive decisions

- **Trust over noise.** A false alarm is a bug. When in doubt, Pragu stays silent and lowers confidence.
- **Local-first.** Nothing leaves the machine by default. The agent cannot use the network.
- **Honest.** "Automated checks", never "compliant". Every report says what it cannot check.
- **Human-centred.** Every issue names who it hurts and what they experience.

## Success metrics

| Metric | Target | When |
|---|---|---|
| Precision of every shipped "error" rule on Pragu Bench | ≥ 0.90, published | M1 |
| Time from `npx pragu scan` to report on a clean machine | ≤ 60 s, plus the one-off agent install | M2 |
| Scan time per screen; report size per 20 screens | Budgets set from measurements in M1, then enforced in CI | M1 |
| Teams running Pragu in CI | 3 design partners at v0.1, 3 external teams at 1.0 | M2, M5 |

## Risks

| Risk | Mitigation |
|---|---|
| False positives destroy trust | Precision gates in CI; confidence levels; e.g. the target rule cannot see React Native `hitSlop`, so it is medium confidence |
| `UiAutomation` is exclusive and conflicts with test frameworks during flows | ADR-001; the M3 RFC decides interleaving or an accessibility-service mode |
| Screenshots of sensitive apps leak | Agent has no network permission; `--redact`; warning about cloud-synced output folders; see the threat model |
| Emulator CI is flaky or slow | Fixture APK cached; capture retries; per-screen budgets |
| Overclaiming legal compliance | Wording rules in docs and in the report itself |

# ADR-015: Evaluate rules on real apps, labelled blind

- Status: Accepted (2026-11-03, decided on Florent's instruction; see `docs/decisions.md`). Real bench v1 in M2.
- Date: 2026-11-03

## Context

Pragu Bench today measures rules on our own fixtures: we wrote both the barrier and the rule, so the numbers are partly circular. Several error rules rest on one or two true positives, and a precision of 1.00 on two cases says little. The brief asks for real open-source apps with hand-labelled screens, published like JavaSmell's MCC table, never rounded up. This is also the evidence a thesis or an interviewer will question first.

## Decision

- **Two benches.** The *seeded* bench (fixtures) stays the regression gate: CI reproduces it exactly. The *real* bench (open-source apps) provides the numbers Pragu quotes in public.
- **Real bench v1 (M2):** at least 5 apps and 20 distinct screens. Mix toolkits (Views, Compose, React Native, and Flutter if a suitable app exists) and categories the EAA covers (shopping, reading, transport, money tools). Only apps whose licence allows redistribution. Recordings live in `bench/real/<app>/` with the app's name, version, licence and source. No proprietary app ever enters the repository. APKs are not committed; recordings are.
- **Blind labelling.** Florent labels each screen before seeing Pragu's output on it, following a written protocol (`bench/real/PROTOCOL.md`):
  - every element, for every rule Pragu has, as barrier, correct or not applicable;
  - evidence from TalkBack on a phone, contrast measured from the screenshot's pixels, and target sizes from the element bounds;
  - no automated accessibility checker during labelling.
  A second labeller re-labels at least 20% of the screens, and Cohen's kappa is published.
- **Held-out test set.** Apps are split, by app and not by screen, into a *dev* half (rules may be tuned on it; CI scores it) and a *test* half. The test half is scored only at releases, and its numbers are the ones published.
- **Metrics:** precision, recall, F1 and MCC with their counts, plus Wilson 95% intervals for precision and recall. Ratios are truncated.
- **Gates** (also in `docs/decisions.md`): from v0.1, an error rule needs precision ≥ 0.90 on the seeded bench and also on the real bench once it has at least 5 labelled barriers there; otherwise it ships as a warning. At 1.0: a Wilson lower bound ≥ 0.80 on the real test set (at least 16 true positives with no false positive).
- **Comparator:** Google's Accessibility Test Framework runs on the same recordings through a bench-only agent variant that is never shipped. Its findings are mapped to Pragu's rule ids. The question is: is Pragu better than the free baseline, rule by rule?

## Consequences

- Real recordings are made locally on the emulator. Florent approves each APK download. CI re-scores the dev set without a device, like the seeded bench.
- The M1 exit criterion "20 screens" can be met honestly by this bench (needs Florent's approval).
- Labelling takes time: about 30 minutes per screen at first. It is the most valuable time in the project.

## Alternatives

- Fixtures only: cheap, circular.
- Using ATF's output as the ground truth: circular the other way, and blind to what ATF misses.
- Crowd labelling: no budget, and the labellers would need TalkBack training.

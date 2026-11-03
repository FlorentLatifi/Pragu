# Walkthrough: the owner tasks, built by Claude

On 2026-11-03 Florent asked Claude to implement the owner tasks too. They were meant to teach parts of Pragu by writing them; this page is the replacement: what each does, where to read it, the decision inside it, and one question to be able to answer. Read the code next to it.

## 1. Wilson intervals (`bench/src/metrics.ts`, `wilson`)

**What:** next to every precision and recall, the Wilson 95% interval: `name/image-missing` shows `1.00 [0.20, 1.00]` because it rests on one case.

**Decision:** published intervals are widened outward (low cut down, high raised), the mirror of "never round a ratio up".

**Question:** why does the textbook interval p ± 1.96·√(p(1−p)/n) fail at 2 out of 2, and what does Wilson do instead? (It collapses to [1, 1]; Wilson centres the interval away from the edge and keeps it inside 0–1.)

## 2. The Pragu score (`packages/core/src/score.ts`)

**What:** ADR-012's formula: per screen, each rule's default weight (severity × confidence, in tenths), 75% of it for the first reported element and half the rest for each next one; rules without their input (`requires`) left out; the scan's score is the floored mean of its screens'.

**Decisions:** default weights, so config cannot raise a score; "not checked" is not "passed"; a score delta in the pull-request comment only between comparable results (same version, same rules).

**Proof:** fast-check properties (bounded, 100 only with no weighted finding, strictly lower when one is added, order-independent) and the ADR's worked example from real recordings.

**Question:** a team turns `contrast/text` down to a warning in its config. What happens to the build, and to the score? (The build stops failing on it; the score is unchanged.)

## 3. SARIF (`packages/core/src/sarif.ts`, `packages/cli/src/locate.ts`)

**What:** `--format sarif` writes `pragu-results.sarif` for GitHub code scanning. Rules become `reportingDescriptor`s with WCAG tags; severities map to `error`, `warning`, `note`; the fingerprint goes in `partialFingerprints`; `baselineState` says new or unchanged.

**The open question, answered:** GitHub needs a physical location (file, line) on every result. Pragu searches the project for the one line that names the element's testID or resource id; on the rn-shop fixture all five cart barriers land on their lines in `CartScreen.tsx`. Otherwise it points at the screen's line in `pragu.config.ts`, or the first line of the config or `package.json`.

**Question:** what does GitHub do with `partialFingerprints`, and why does Pragu still add its own? (GitHub tracks an alert across runs by fingerprint and uses `primaryLocationLineHash`; Pragu's fingerprint survives layout changes that move lines.)

## 4. Three rules (`packages/core/src/rules/`)

- **`name/generic` (warning):** a short, documented list (role words, "click here") plus resource-like names (`ic_close`, `img_1234.png`, `button1`, `snake_case`). "Close", "Back" and "More options" pass: a short list with no false alarms beats a long one.
- **`contrast/non-text` (warning):** icon buttons with no text, measured by the same estimator as `contrast/text`, 3:1. Silent on busy backgrounds and disabled controls.
- **`target/platform-size` (info):** its own rule id, so the bench measures it apart from `target/size`. 24 to 48 dp, with half a dp for pixel rounding (a Compose IconButton read as 48 × 47.6 dp).

**What the bench taught:** a 40 dp Compose Box seeded as a barrier was not one. Compose enlarges a small clickable's touch area to 48 dp and reports that area, so the label was wrong, not the rule; it is now a correct twin. React Native's stock `Switch` (27 dp tall) and a 24 dp checkbox are real misses of the 48 dp guidance.

**Question:** why is `target/platform-size` an info and `target/size` a warning, when both are about size? (2.5.8's 24 dp is a WCAG AA requirement; 48 dp is platform guidance, beyond AA; and both stay below error because `hitSlop` is invisible.)

## Still Florent's, and why

- **Labelling the real bench:** blind labels must come from someone who did not write the rules, using TalkBack on a phone. Claude wrote the rules and has no phone.
- **The TalkBack check on a phone (D-14):** needs a phone.
- **Accounts and secrets** (npm organisation, Pages, release keystore): only the account owner can create them, and a keystore must never pass through the assistant.

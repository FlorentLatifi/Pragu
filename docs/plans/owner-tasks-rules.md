# Owner tasks: three rules

**Who:** Florent writes them; Claude reviews. M1 plan, owner-implements tasks 1–3. Each is small, teaches one part of Pragu, and follows the same path as every rule so far (look at `packages/core/src/rules/state-not-exposed.ts` and its tests for the shape).

**Every rule needs** (CLAUDE.md): metadata (WCAG, EN 301 549, who is affected, what they experience, React Native / Compose / Views fixes), positive and negative tests, and a fixture barrier with a correct twin, labelled in the fixture's `expected.json` and recorded into the bench (`pnpm fixture:build`, `pnpm bench:record --only <fixture>`, `pnpm bench:update`). A false alarm is a bug: when unsure, stay silent or lower the confidence.

The behaviours to prove are already in `packages/core/test/owner-rules.test.ts` as `it.todo` entries.

## 1. `target/size` platform tier (info)

**What:** targets of at least 24 dp (they pass WCAG 2.5.8) but under Android's own 48 dp guidance get an **info** finding (ADR-007). Teaches dp versus CSS px.

- Start from `packages/core/src/rules/target-size.ts`. Decide one thing first and write it in the PR: a separate rule id (`target/platform-size`, measured on its own in the bench) or the same rule with per-finding severity (`Finding.severity`), which would mix both tiers in one bench row. The separate id is easier to measure.
- Compose reports touch areas, not drawn sizes (ADR-009, `boundsAreTouchArea`): a Compose target already enlarged to 48 dp must not be flagged.
- Fixture idea: a 40 dp button in rn-shop (barrier for this tier, twin for `target/size`), next to a 48 dp twin.

## 2. `name/generic` (warning)

**What:** a control whose name says nothing about its purpose: "Button", "Image", "Icon", "Click here", "More", file or resource names such as `ic_close`, `img_1234.png`, `button1`. WCAG 2.4.6 and 2.5.3. Pure string heuristics, very testable.

- Compare normalised names (trim, lowercase) against a small, documented list. Prefer a short list with no false alarms over a long one: "Close" and "Back" are fine names, "Button" is not.
- Names that only repeat the role ("Button" on a button) are the clearest case; resource-like names (`snake_case`, digits, file extensions) the second.
- Fixture idea: an icon button whose `accessibilityLabel` is "Button", next to a twin named "Add to wishlist".

## 3. `contrast/non-text` (warning)

**What:** WCAG 1.4.11: icons and the visible parts of controls (borders, toggles) need 3:1 against what is next to them. Reuses the colour math in `packages/core/src/color.ts`.

- Scope it tightly at first: interactive elements with no text of their own (icon buttons), estimating the icon colour against the background inside the element's bounds with `estimateTextColors`. That function returns null on busy backgrounds; keep that silence.
- Disabled controls are exempt, as in `contrast/text`. Compose touch areas are larger than the icon: the icon is in the middle, the rest is background, which suits the estimator.
- Fixture idea: a pale grey heart icon (#C8C8C8 on white, 1.6:1) next to a dark twin.

## Done when

- The `it.todo` entries for the rule are real tests and pass; the rule is in `defaultRules` and the bench shows it with no false positives on all screens.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm bench` pass; core coverage stays at 90% or more.
- You can explain in the walkthrough each threshold you chose and one case you decided to leave silent.

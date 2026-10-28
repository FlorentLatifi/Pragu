# ADR-007: Report `target/size` as a warning until Pragu can see `hitSlop`

- Status: Accepted (Florent, 2026-10-28). Revisit in M4.
- Date: 2026-10-28

## Context

React Native's `hitSlop` enlarges a touchable's touch area in JavaScript. The accessibility tree never shows it, so Pragu sees a 16 dp icon where WCAG 2.5.8 sees a 48 dp target. Pragu Bench made this concrete: the fixture's `hitSlop` twin is a false positive, and `target/size` scores precision 0.75 against the 0.90 bar for error rules. Error rules fail builds by default, and the brief's first principle is trust over noise.

## Decision

`target/size` reports below-minimum targets as **warnings**, with medium confidence, instead of errors. It keeps detecting them; it stops failing builds at the default `--fail-on error`. Teams that want it blocking use `--fail-on warning`.

The platform-guidance tier (below 48 dp / 44 pt) sits one level lower: info now, warning once the rule returns to error.

## When to restore it to error

- **M4:** React Native source mapping lets Pragu read `hitSlop` from the code and size the real target.
- **Possibly earlier, for native views:** Android exposes `TouchDelegate` areas to accessibility services (`AccessibilityNodeInfo.getTouchDelegateInfo()`, API 29+). The agent could capture them, so native targets with a touch delegate are sized correctly.

Restore it only when the bench shows precision ≥ 0.90 with the `hitSlop` twin still in it.

## Consequences

- Builds stop failing on a check that cannot see the whole truth; findings still appear in every report and PR comment.
- The bench keeps the `hitSlop` twin, so the 0.75 stays published until it is fixed for real.

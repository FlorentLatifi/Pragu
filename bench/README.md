# Pragu Bench

Measures whether Pragu's rules are right, rule by rule, on screens where we know the truth. The published results are in [docs/bench/results.md](../docs/bench/results.md).

## How it works

1. **Ground truth** lives with each fixture (`rn-shop` for React Native, `android-compose` for Jetpack Compose): `fixtures/<name>/expected.json` names the app and its APK and lists, per screen, the *barriers* that must be reported and the *correct twins* that must not be, by `testID`. Rules that do not exist yet can be labelled already; they are skipped until implemented.
2. **Recordings** are real captures (accessibility tree + screenshot) in `bench/recordings/<fixture>/<screen>.json|png`, made on an emulator by `pnpm bench:record`. The recorder opens each screen by deep link on a fresh app start and rejects a capture that lacks the screen's marker.
3. **Evaluation** (`pnpm bench`) re-runs the current rules on the recordings, with no device, and counts per rule:
   - TP: a barrier was reported. FP: anything else was reported. FN: a barrier was missed. TN: a twin was left alone.
   - Precision, recall, F1 and MCC follow. Ratios are truncated, never rounded up.
4. **The gate:** `bench/results.json` holds the published numbers. CI fails when a fresh evaluation differs: a drop in precision or recall is a regression; any other change means the published table must be updated on purpose with `pnpm bench:update`.

## Commands

```bash
pnpm build && pnpm bench          # score the recordings against the published results (CI)
pnpm bench:update                 # accept new results: rewrites results.json and docs/bench/results.md
pnpm bench:record                 # re-record all screens (emulator running, fixture APKs built)
pnpm bench:record --only android-compose   # re-record one fixture, leaving the others untouched
```

## Adding a screen

Add the screen to the fixture app with a deep link and a marker `testID`, label it in `expected.json`, rebuild the APK (`pnpm fixture:build`), run `pnpm bench:record`, then `pnpm bench:update`. Commit the fixture, labels, recordings and results together.

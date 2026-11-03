# Roadmap

Milestones come from the [founding brief](docs/00-founding-brief.md); dates depend on progress, not promises.

| Milestone | Focus | State |
|---|---|---|
| M0 Foundations | Environment, docs, repo, CI, walking skeleton | Done (approved) |
| M1 Android MVP | Full initial rule set, transcript, report v1, config, JSON/SARIF, `doctor`, baselines, Pragu Bench v1 | Closing: owner tasks and the TalkBack check left ([plan](docs/plans/m1.md)) |
| M2 CI + public v0.1 | Several screens per scan, Pragu score, real-app bench, GitHub Action, PR comment, SARIF upload, docs site, launch | In progress ([plan](docs/plans/m2.md)) |
| M3 Coverage | Maestro/Detox flows, safe crawler, font-scale and theme matrix, Expo config plugin | Planned |
| M4 Intelligence | Label suggestions (local first), React Native source mapping | Planned |
| M5 Fixes + 1.0 | Verified auto-fix PRs, API stability, benchmark write-up | Planned |

## Ideas parked for later

Not in any milestone yet; noted so they don't creep into code early. Decisions about what comes when are in [docs/decisions.md](docs/decisions.md).

- Capture native `TouchDelegate` areas (`getTouchDelegateInfo()`, API 29+), so `target/size` can size native targets correctly before M4 (ADR-007).
- `state/not-exposed` for home-made toggles with no role: tap the element during a crawl (M3) and report it when its pixels change but no state does.
- `text/scaling-truncation` for text cut off by a fixed-height box, which character positions cannot show (ADR-011); and running `--check-font-scale` by default once the bench shows it is safe on more apps.
- `input/placeholder-label`: type into each field during a crawl (M3) and report fields whose only label disappears. Labelled in both fixtures already (ADR-010).
- `text/scaling-truncation` on Android 11 (API 30): the weekly run found none of the seeded cut-off texts there, while Android 16 finds all four of those it is labelled for. Find which API level the character-position data starts to work at, and have `doctor` and the report say so below it.
- Tell which toolkit built the app (Compose host views, React Native libraries in the APK), so reports lead with that toolkit's fix.
- Per-role fixes in `name/interactive-missing`: for a switch or checkbox, a toggleable row that its text names beats a content description.

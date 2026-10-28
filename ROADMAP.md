# Roadmap

Milestones come from the [founding brief](docs/00-founding-brief.md); dates depend on progress, not promises.

| Milestone | Focus | State |
|---|---|---|
| M0 Foundations | Environment, docs, repo, CI, walking skeleton | In progress |
| M1 Android MVP | Full initial rule set, transcript, report v1, config, JSON/SARIF, `doctor`, baselines, Pragu Bench v1 | Planned ([plan](docs/plans/m1.md)) |
| M2 CI + public v0.1 | GitHub Action, PR comment, SARIF upload, docs site, launch | Planned |
| M3 Coverage | Maestro/Detox flows, safe crawler, font-scale and theme matrix, Expo config plugin | Planned |
| M4 Intelligence | Label suggestions (local first), React Native source mapping | Planned |
| M5 Fixes + 1.0 | Verified auto-fix PRs, API stability, benchmark write-up | Planned |

## Ideas parked for later

Not in any milestone yet; noted so they don't creep into code early.

- Warn when `--out` is inside a cloud-synced folder (OneDrive, Dropbox, iCloud), since reports contain screenshots.
- Capture native `TouchDelegate` areas (`getTouchDelegateInfo()`, API 29+), so `target/size` can size native targets correctly before M4 (ADR-007).
- `state/not-exposed` for home-made toggles with no role: tap the element during a crawl (M3) and report it when its pixels change but no state does.
- `input/placeholder-label`: type into each field during a crawl (M3) and report fields whose only label disappears. Labelled in both fixtures already (ADR-010).
- Tell which toolkit built the app (Compose host views, React Native libraries in the APK), so reports lead with that toolkit's fix.
- Per-role fixes in `name/interactive-missing`: for a switch or checkbox, a toggleable row that its text names beats a content description.
- WebP screenshots in reports (decided against the report-size budget in M1).
- An `AccessibilityService` capture mode for live exploration (M3 RFC).
- iOS runner on macOS CI runners, when there is no local Mac.

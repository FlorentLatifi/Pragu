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
- Agent idle timeout, so an abandoned session stops by itself.
- WebP screenshots in reports (decided against the report-size budget in M1).
- An `AccessibilityService` capture mode for live exploration (M3 RFC).
- iOS runner on macOS CI runners, when there is no local Mac.

# Threat model and privacy review (M0)

Method: STRIDE over the M0 architecture, in the spirit of Microsoft's SDL. Review it again whenever a trust boundary changes: flows (M3), AI providers (M4), auto-fix PRs (M5). The GitHub Action and release pipeline were reviewed on 2026-11-03 (below).

## Assets

1. **Screen content of the app under test:** screenshots and accessibility trees. These can contain personal, health or banking data.
2. **The developer's device and machine:** the agent holds `UiAutomation`, which can read every screen.
3. **Supply chain:** npm packages, the agent APK, GitHub Actions, and the signing keys (M2).
4. **Users' source code:** read by source mapping and auto-fix from M4 onwards, and since 2026-11-10 by `pragu comment` (the "Likely here" line, ADR-014): it only searches for an element id as plain text under `--source-root`, skips symlinks, never sends anything anywhere and keeps at most 64 MB in memory.

## Trust boundaries

Machine ↔ device (adb) · agent ↔ other apps on the device · CLI ↔ the file system where reports land · CI ↔ secrets and artifacts · (M4) machine ↔ opt-in AI provider.

## STRIDE

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| **Spoofing** | Another app on the device connects to the agent's socket and requests screenshots | Peer uid allowlist (0 root, 2000 shell); random socket name per session (ADR-006) | Done |
| Spoofing | A tampered agent APK is installed in place of the real one | The CLI installs only the APK it ships, and refuses a bundled APK whose SHA-256 differs from the one written at release. Release signing from CI secrets and npm provenance are in the release workflow, waiting for the first release (ADR-013) | Partly |
| Tampering | `--check-font-scale` leaves the device at 200% text after a failure | Opt-in only. The original value is read first and restored in a `finally` and on Ctrl+C; an unset value is deleted again. A killed process or crashed emulator can still skip it, so the scan says it changes the setting (ADR-011) | Done |
| **Tampering** | A crafted capture file (`--from-capture`) exploits the report | `parseAndroidCapture` validates every field. All app text is HTML-escaped (tested with an `<img onerror>` payload) | Done |
| Tampering | The app under test manipulates its own tree to hide issues | Out of scope: Pragu audits apps for their own developers | Accepted |
| **Repudiation** | Unclear which Pragu version produced a report | Tool version, schema version and timestamp are in every result and report | Done |
| **Information disclosure** | Reports with banking screenshots are uploaded by a cloud-sync folder | Local-first; no telemetry. A scan warns when `--out` is inside OneDrive, Dropbox, iCloud Drive or Google Drive (D-34). `--redact` writes a report for sharing: the app's text covered in screenshots and replaced in names, quotes and JSON, no raw captures (D-33). Images are not covered | Done |
| Information disclosure | Report artifacts on public CI runs expose screenshots | Docs warning; short artifact retention; redact by default in the GitHub Action (M2) | M2 |
| Information disclosure | The agent sends data off the device | The APK has no INTERNET permission, enforced by a build check. Captures stream over adb and are never written to device storage | Done |
| Information disclosure | A capture includes other apps' or system UI's content (notifications, a password manager overlay) | Only the scanned app's windows carry element trees; every other window is reported as a bare rectangle (ADR-008). The screenshot still shows the whole screen; `--redact` covers the app's own text, not other windows' | Done (trees) |
| Information disclosure | Toolchain telemetry, e.g. the Android CLI's default metrics | Scripts and docs always pass `--no-metrics`; the Pragu CLI makes no network requests | Done |
| **Denial of service** | An orphaned agent keeps running, or a huge request exhausts memory | `force-stop` before each session; `shutdown` command; 64 kB request-line limit; capture timeout clamped to 120 s | Done (idle timeout in M1) |
| **Elevation of privilege** | Another app triggers the agent to use its `UiAutomation` | No exported components; only `adb shell am instrument` (shell uid) can start it; the APK requests no permissions | Done |
| Elevation of privilege | A compromised dependency in CI steals secrets | Actions pinned by SHA; `permissions: contents: read`; pnpm release-age guard; Dependabot | Done in M0 CI |

## Review: the GitHub Action and the release pipeline (2026-11-03, D-38)

New trust boundaries: the user's CI ↔ GitHub (comments, artifacts, code scanning) and Pragu's release workflow ↔ npm.

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | A fork's pull request posts a comment, or reads secrets, through the action | The action comments only when the pull request comes from the same repository; forks get the job summary. It never uses `pull_request_target` (ADR-014) | Done |
| Tampering | App text crafted to inject Markdown or HTML into the comment | `pragu comment` escapes Markdown in every text from the app; the comment is plain Markdown with no raw HTML from the app. Element ids and repository file paths in the "Likely here" line are code spans with backticks, control characters and line breaks removed (tested with hostile ids and paths) | Done |
| Tampering | Shell injection through action inputs | Inputs reach shell steps only as environment variables, never inlined into scripts | Done |
| Information disclosure | Screenshots in a public repository's artifact | `--redact` on by default for public repositories in the starter workflow; 7-day retention; no raw captures in a redacted report (D-33) | Done |
| Elevation of privilege | Excess token permissions | `contents: read`, `pull-requests: write`, `actions: read`, `security-events: write`, documented; nothing else | Done |
| Tampering | A hijacked release publishes a malicious agent | Tag-only release workflow in a `release` environment; npm trusted publishing (OIDC, no long-lived token) with provenance; the CLI checks the bundled agent's SHA-256 before installing it (ADR-013) | Ready, first release pending |
| Information disclosure | The release keystore leaks | Only in GitHub secrets, decoded to a temporary file during the build and deleted after; never in the repository or on a developer machine | Pending: Florent creates it |

Out of scope: an attacker who already has adb access. adb is full control of the device by design.

## Privacy review

| Data | Where it goes | Retention | Who controls it |
|---|---|---|---|
| Accessibility tree, screenshot | Device → adb → `--out` folder on the developer's machine | Until the developer deletes it | The developer |
| Result JSON, HTML report | Same folder; CI artifacts only if the team uploads them | The team's own policy | The team |
| Usage telemetry | None | None | — |
| AI label suggestions (M4) | Off by default. Opt-in sends screenshots to the provider of the user's choice, with an explicit warning first | Per provider terms | The user |

Under GDPR, Pragu is a local tool, not a processor: nothing reaches the Pragu project. Teams scanning apps with real personal data should use test accounts and test data. The crawler (M3) runs only against test builds.

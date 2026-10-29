# Threat model and privacy review (M0)

Method: STRIDE over the M0 architecture, in the spirit of Microsoft's SDL. Review it again whenever a trust boundary changes: flows (M3), AI providers (M4), auto-fix PRs (M5).

## Assets

1. **Screen content of the app under test:** screenshots and accessibility trees. These can contain personal, health or banking data.
2. **The developer's device and machine:** the agent holds `UiAutomation`, which can read every screen.
3. **Supply chain:** npm packages, the agent APK, GitHub Actions, and the signing keys (M2).
4. **Users' source code:** read by source mapping and auto-fix from M4 onwards.

## Trust boundaries

Machine ↔ device (adb) · agent ↔ other apps on the device · CLI ↔ the file system where reports land · CI ↔ secrets and artifacts · (M4) machine ↔ opt-in AI provider.

## STRIDE

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| **Spoofing** | Another app on the device connects to the agent's socket and requests screenshots | Peer uid allowlist (0 root, 2000 shell); random socket name per session (ADR-006) | Done |
| Spoofing | A tampered agent APK is installed in place of the real one | The CLI installs only the APK it ships. Signed release APK, checksum and npm provenance (M2) | M2 |
| Tampering | `--check-font-scale` leaves the device at 200% text after a failure | Opt-in only. The original value is read first and restored in a `finally` and on Ctrl+C; an unset value is deleted again. A killed process or crashed emulator can still skip it, so the scan says it changes the setting (ADR-011) | Done |
| **Tampering** | A crafted capture file (`--from-capture`) exploits the report | `parseAndroidCapture` validates every field. All app text is HTML-escaped (tested with an `<img onerror>` payload) | Done |
| Tampering | The app under test manipulates its own tree to hide issues | Out of scope: Pragu audits apps for their own developers | Accepted |
| **Repudiation** | Unclear which Pragu version produced a report | Tool version, schema version and timestamp are in every result and report | Done |
| **Information disclosure** | Reports with banking screenshots are uploaded by a cloud-sync folder | Local-first; no telemetry. Planned: warn when `--out` is inside OneDrive, Dropbox or iCloud (M1); `--redact` blurs text (M1) | Partly |
| Information disclosure | Report artifacts on public CI runs expose screenshots | Docs warning; short artifact retention; redact by default in the GitHub Action (M2) | M2 |
| Information disclosure | The agent sends data off the device | The APK has no INTERNET permission, enforced by a build check. Captures stream over adb and are never written to device storage | Done |
| Information disclosure | A capture includes other apps' or system UI's content (notifications, a password manager overlay) | Only the scanned app's windows carry element trees; every other window is reported as a bare rectangle (ADR-008). The screenshot still shows the whole screen, which `--redact` will address (M1) | Done (trees) |
| Information disclosure | Toolchain telemetry, e.g. the Android CLI's default metrics | Scripts and docs always pass `--no-metrics`; the Pragu CLI makes no network requests | Done |
| **Denial of service** | An orphaned agent keeps running, or a huge request exhausts memory | `force-stop` before each session; `shutdown` command; 64 kB request-line limit; capture timeout clamped to 120 s | Done (idle timeout in M1) |
| **Elevation of privilege** | Another app triggers the agent to use its `UiAutomation` | No exported components; only `adb shell am instrument` (shell uid) can start it; the APK requests no permissions | Done |
| Elevation of privilege | A compromised dependency in CI steals secrets | Actions pinned by SHA; `permissions: contents: read`; pnpm release-age guard; Dependabot | Done in M0 CI |

Out of scope: an attacker who already has adb access. adb is full control of the device by design.

## Privacy review

| Data | Where it goes | Retention | Who controls it |
|---|---|---|---|
| Accessibility tree, screenshot | Device → adb → `--out` folder on the developer's machine | Until the developer deletes it | The developer |
| Result JSON, HTML report | Same folder; CI artifacts only if the team uploads them | The team's own policy | The team |
| Usage telemetry | None | None | — |
| AI label suggestions (M4) | Off by default. Opt-in sends screenshots to the provider of the user's choice, with an explicit warning first | Per provider terms | The user |

Under GDPR, Pragu is a local tool, not a processor: nothing reaches the Pragu project. Teams scanning apps with real personal data should use test accounts and test data. The crawler (M3) runs only against test builds.

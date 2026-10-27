# Security policy

Pragu's Android agent can read the screen of the app under test, so we take reports seriously.

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub: **Security → Report a vulnerability** on this repository. We aim to acknowledge reports within 3 working days, and to agree a disclosure date with you once a fix is ready.

## Supported versions

Pragu is pre-release (0.x). Only the latest commit on `main` receives fixes.

## Design safeguards

- The agent APK has no INTERNET permission; a build check enforces it.
- The agent accepts connections only from adb (shell) or root.
- Captures stream to your machine over adb and are never written to device storage.
- Pragu has no telemetry.

See [docs/security/threat-model.md](docs/security/threat-model.md).

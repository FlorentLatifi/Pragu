# Environment and name check

Date: 2026-10-27. Evidence for M0 steps 2 and 4 of the [founding brief](../00-founding-brief.md). All checks were read-only; nothing was installed or changed.

## Machine

| Item | Found | Action |
|---|---|---|
| OS | Windows 11 Pro, build 26300, x64 | None |
| CPU, RAM | AMD Ryzen 7 5825U (8 cores, 16 threads), 15.3 GB | None |
| Virtualisation | SVM enabled in firmware. A hypervisor is running because Virtual Machine Platform (WSL2) is on. The "Windows Hypervisor Platform" feature reports as disabled. | None needed. Corrected after testing: `emulator -accel-check` reports "WHPX(10.0.26300) is installed and usable", and the API 36 emulator boots accelerated on this build without enabling the feature. |
| Disk | 29.9 GB free of 476 GB on `C:`. Docker Desktop's data disk is 37.8 GB. | Free space to at least 50 GB. The Android toolchain needs roughly 25–30 GB (estimate). |
| Long paths | `LongPathsEnabled = 0`; git `core.longpaths` unset | Enable both |
| Project folder | `C:\Users\flore\OneDrive\Desktop\Pragu`, synced by OneDrive (running) | Move to `C:\dev\pragu`. Reports hold app screenshots that OneDrive would upload, sync locks break installs and builds, and React Native's native (C++) builds on Windows are known to break on long paths. |

## Toolchain

| Tool | Found | Target |
|---|---|---|
| Node | 22.14.0 | 24 LTS (24.22.1 on 2026-10-27). Node 26 is not LTS yet. |
| pnpm | Missing | 12.15.0, if chosen over npm |
| git | 2.53.0; identity Florent Latifi with GitHub noreply email; Git Credential Manager handles pushes | None |
| gh | 2.96.0, logged in as FlorentLatifi | None |
| JDK | Oracle JDK 21, original 21+35 build from 2023, at `JAVA_HOME` | Add JDK 17. React Native 0.88 docs recommend 17 and warn about higher versions. |
| Android Studio, SDK, adb, emulator | Missing | Android Studio 2026.2.1; `platforms;android-36`, `build-tools;36.0.0`, `system-images;android-36;google_apis_playstore;x86_64` |
| Xcode | Not applicable (Windows) | iOS work needs a Mac |
| Docker | Installed | Not needed for M0 |

Newest versions on 2026-10-27: Expo SDK 58 (`expo@58.0.19`), React Native 0.88.1, Android platforms up to 37.x, build-tools 37.0.0.

## Name

| Check | Result |
|---|---|
| npm `pragu`, `pragu-cli`, `@pragu/core`, `@pragu/cli` | Unclaimed (registry 404). npm search for "pragu" returns 0 packages. |
| npm `@pragu` scope | No org record. npmjs.com blocked the user-page check, so confirm by creating the org. |
| GitHub `pragu` | Taken by a personal account (since 2012, 2 unrelated repos). A `pragu` organisation is not possible. |
| GitHub `pragu-dev`, `praguhq`, `getpragu`, `pragu-a11y` | Free |
| `FlorentLatifi/Pragu` | Exists: public, empty, created 2026-10-27 |
| `pragu.dev`, `pragu.app`, `pragu.org`, `getpragu.com` | No registration record (RDAP). Price not checked. |
| `pragu.com` | Registered since 2010-07-25, expires 2027-07-25 |
| `pragu.io`, `pragu.sh` | Not confirmed (no RDAP service) |
| PyPI `pragu` | Unclaimed |
| Conflicting projects | None found. Web search and GitHub search treat "pragu" as a misspelling of "Prague". |

This is not a trademark clearance. An EUIPO/TMview search belongs on the v0.1 launch checklist.

## How it was checked

- Machine: `Get-CimInstance` (OS, CPU, RAM, disks, optional features), registry reads, `command -v` and `--version` for each tool, `gh auth status`, `git config`.
- Versions: nodejs.org `dist/index.json`, npm registry dist-tags, Google's SDK repository XML (`repository2-3.xml`, `sys-img2-3.xml`), `winget show`.
- Name: npm registry API, GitHub REST API via `gh`, RDAP via rdap.org (registry data rather than a registrar search box), web search.

## Sources

- Android Emulator hardware acceleration: https://developer.android.com/studio/run/emulator-acceleration
- React Native environment setup, Windows + Android (docs version 0.88): https://reactnative.dev/docs/set-up-your-environment?os=windows&platform=android
- Node.js release index: https://nodejs.org/dist/index.json

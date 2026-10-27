# ADR-006: The agent talks to the CLI only through adb

- Status: Accepted
- Date: 2026-10-27

## Context

The agent can read every screen and take screenshots, which often show personal or financial data. The brief's hard constraint: the agent APK must not request the INTERNET permission.

## Decision

- The agent listens on an **abstract Unix socket** with a random name per session (`pragu-<8 hex>`). The CLI reaches it with `adb forward tcp:0 localabstract:<name>` and connects to 127.0.0.1.
- Abstract sockets need no permission, and nothing listens on a network port.
- **Peer check:** the agent accepts connections only from uid 2000 (shell, which is what adb runs as) or uid 0 (root). Other apps on the device cannot ask it for screenshots.
- **No INTERNET permission, enforced:** the Gradle task `verify<Variant>NoInternetPermission` fails the build if the merged manifest contains it. CI runs it on every change.
- **No exported components:** the APK has no activities, services or receivers. Only `adb shell am instrument` can start it.
- **Protocol 1:**
  - A request is one JSON line: `hello`, `capture`, `shutdown`.
  - A response is one JSON header line `{"ok":…,"payloads":[{name, bytes, type}]}`, followed by the raw payload bytes.
  - Captures stream straight to the computer and are never written to the device's storage.
- At the start of every scan the CLI runs `am force-stop dev.pragu.agent`, so an earlier crashed session cannot linger.

## Alternatives

- Write files to `/sdcard` and `adb pull` them: screenshots would sit on shared storage until cleaned up.
- Instrumentation status output: limited by the binder transaction size (about 1 MB), so screenshots don't fit.
- A TCP server on the device: needs INTERNET, and any app could connect.

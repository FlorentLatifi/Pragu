---
title: Command line
description: Every pragu command and flag.
---

| Command | What it does |
|---|---|
| `pragu scan --app <id>` | Scan the app's screens and write the report and JSON |
| `pragu init [--github]` | Write a starter `pragu.config.ts`, and a GitHub workflow with `--github` |
| `pragu doctor` | Check Node, adb, the device and the agent, with exact fixes |
| `pragu baseline create\|update --from <result>` | Accept a scan's issues |
| `pragu report <result> [--out <file>]` | Render the HTML report again from a result |
| `pragu comment <result> [--base <main result>]` | Write the pull-request comment |
| `pragu rules [--explain <id>]` | List the rules, or explain one |

## `pragu scan` flags

| Flag | What it does |
|---|---|
| `--app <id>` | Application id to launch and scan |
| `--screen <name>` | Scan only this screen from the config |
| `--out <dir>` | Where to write the report (default `pragu-report`) |
| `--fail-on error\|warning\|info\|never` | Exit 1 on issues at this level or worse (default `error`) |
| `--baseline <file>` | Fail only on issues not in this baseline |
| `--check-font-scale` | Also capture at 200% text; changes and always restores the device's font size |
| `--redact` | Write a report for sharing: the app's text covered and replaced, no raw captures |
| `--no-launch` | Scan what is on show instead of launching the app |
| `--screen-name <name>` | Name for the screen when no screens are configured |
| `--from-capture <file>` | Analyse a saved capture or `screens.json` again, without a device |
| `--install <apk>` | Install this APK first |
| `--serial <id>` | Device to use when several are connected |
| `--config <file>` | Use this config file |
| `--verbose` | Print each adb command and agent request with its duration |

Exit codes: 0 no issues at the threshold, 1 issues found, 2 usage error, 3 environment error. Flags win over `pragu.config.ts`.

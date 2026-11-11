---
title: Pull requests on GitHub
description: Comment only the barriers a pull request adds, and keep the report.
---

The action is `FlorentLatifi/Pragu@v0`.

`pragu init --github` writes a starter workflow, `.github/workflows/pragu.yml`. It:

1. builds your APK (add your own build step);
2. starts an emulator with `reactivecircus/android-emulator-runner` and runs `pragu scan`;
3. runs Pragu's action, which comments on the pull request and keeps the report as an artifact.

## What the comment shows

Only what the pull request adds: barriers that are not in the latest scan of your default branch. The workflow also runs on pushes to that branch, so there is always something to compare with; until there is, the baseline decides what is known. Each new barrier has its screen, element, what a screen reader says, and the fixes, folded away. One comment per pull request, updated on every push.

## Forks and privacy

- Pull requests from forks get a read-only token, so they get the same text in the job summary instead of a comment. The action never uses `pull_request_target`.
- On public repositories the workflow scans with `--redact`: the app's text is covered in the screenshots and replaced in the report and JSON, and no raw captures are kept. Anyone signed in to GitHub can download a public repository's artifacts.

## Permissions

`contents: read`, `pull-requests: write` for the comment, `actions: read` for the default branch's report, `security-events: write` for SARIF in code scanning.

---
title: Pull requests on GitHub
description: Comment only the barriers a pull request adds, and keep the report.
---

:::caution
The action is reached as `FlorentLatifi/Pragu@v0` once v0.1 is tagged.
:::

`pragu init --github` writes a starter workflow, `.github/workflows/pragu.yml`. It:

1. builds your APK (add your own build step);
2. starts an emulator with `reactivecircus/android-emulator-runner` and runs `pragu scan`;
3. runs Pragu's action, which comments on the pull request and keeps the report as an artifact.

Both are pinned: the workflow runs the Pragu version that wrote it (`npx --yes pragu@0.1.0`), and the action runs the version it was released with. Change the version in the workflow when you upgrade, or set the action's `pragu` input to run something else.

## What the comment shows

Only what the pull request adds: barriers that are not in the latest scan of your default branch. That is the newest completed run on a push to that branch which kept a report, even if its scan found barriers. Pushes to the default branch scan with `--fail-on never`, so they never fail on findings and always leave a report; pull requests still fail on errors. Until the first push has run, the baseline decides what is known. Each new barrier has its screen, element, what a screen reader says, and the fixes, folded away. One comment per pull request, updated on every push.

## Code scanning

On public repositories the workflow also writes SARIF (`--format html,json,sarif`) and the action uploads it, so barriers show up in the Security tab. Private repositories skip it, because code scanning there needs GitHub Advanced Security.

## Forks and privacy

- Pull requests from forks get a read-only token, so they get the same text in the job summary instead of a comment. The action never uses `pull_request_target`.
- On public repositories the workflow scans with `--redact`: the app's text is covered in the screenshots and replaced in the report and JSON, and no raw captures are kept. Anyone signed in to GitHub can download a public repository's artifacts.

## Permissions

`contents: read`, `pull-requests: write` for the comment, `actions: read` for the default branch's report, `security-events: write` for SARIF in code scanning (used on public repositories).

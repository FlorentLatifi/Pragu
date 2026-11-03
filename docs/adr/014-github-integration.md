# ADR-014: GitHub integration

- Status: Accepted (2026-11-03, decided on Florent's instruction; see `docs/decisions.md`). Implement in M2.
- Date: 2026-11-03

## Context

The brief's v0.1 includes a GitHub Action: a short PR comment listing only new barriers, SARIF upload, and the report as an artifact. Device setup differs per team (emulator image, app build, login), so Pragu cannot own the whole job.

## Decision

- **The device step stays in the team's workflow:** `reactivecircus/android-emulator-runner` runs `npx pragu scan …`. `pragu init --github` writes a starter workflow that does this on pull requests and on pushes to `main`.
- **A composite action at the repository root** (`uses: <owner>/pragu@v0`), with no bundled JavaScript. It:
  1. runs `pragu comment <result.json>`, a new subcommand that renders the comment's Markdown (golden-tested, like the report);
  2. creates or updates one comment per pull request with `gh api`, found by a hidden marker;
  3. uploads the report folder as an artifact, kept 7 days by default;
  4. uploads SARIF when the scan wrote it.
- **"New in this PR"** means: in the head scan, and not in the latest successful scan of `main`. The result comes from that run's artifact, matched by fingerprint (ADR-004). The committed baseline is the fallback when no `main` result exists. The score delta (ADR-012) is shown only when both results are comparable.
- **Pull requests from forks** get a read-only token, so the action writes the same Markdown to the job summary instead of commenting. It never uses `pull_request_target`, which runs untrusted code with secrets.
- **Public repositories:** `--redact` is on by default in the action, and the artifact is only the redacted report (HTML, result JSON, covered screenshots; no raw captures). Artifacts of public repositories can be downloaded by anyone signed in to GitHub, and screenshots can carry test-account data (D-33).
- **Permissions,** documented and minimal: `contents: read`, `pull-requests: write` (comment), `actions: read` (the `main` artifact), `security-events: write` (SARIF).
- **The comment** follows the brief's target: a title with the count of new barriers, then for each: screen › element, what the screen reader says, the WCAG criterion and the fix; then the score change and a link to the report artifact. Known issues are only counted, in one line.

## Why

- Comparing with `main` gives a true "new in this PR" with no bot commits and no write access to the repository. A committed baseline alone would also flag every issue merged since it was last updated.
- A composite action with `gh` has no dependency tree to audit, and the Markdown logic lives in the CLI, where it is tested.

## Alternatives

- A JavaScript action with Octokit: a bundled dependency tree in every user's CI.
- A reusable workflow that owns the emulator: less to write for teams, but it breaks on custom builds and logins.
- Updating the baseline from `main` with bot commits: needs write permission and adds noise to history.

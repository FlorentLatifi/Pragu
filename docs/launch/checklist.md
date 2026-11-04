# v0.1 launch checklist

The brief asks for a Google-style launch checklist before every public release. Each line is checked off with evidence (a link, a command output, a screenshot); nothing is ticked on trust. **F** marks what only Florent can do.

## Product

- [ ] The 60-second quickstart works on a clean machine: Windows, macOS and Linux, `npx pragu` from npm, timed (M2 exit criterion).
- [ ] `pragu doctor` gives the right fix for each missing piece on that clean machine: no adb, no device, wrong Node.
- [ ] Every error rule meets precision 0.90 on the seeded bench and, where it has 5+ labelled barriers, on the real bench's test half (D-08); results published with counts and intervals.
- [ ] The real bench has at least 20 distinct screens across 5 apps (D-16).
- [ ] The transcript checked on a phone with TalkBack (D-14), and the report's wording matches.
- [ ] Report, docs and CLI pass the axe checks (CI: `report:a11y` 24 runs and `docs:a11y` 24 runs pass, 2026-11-03); still to do: a keyboard walk-through and a screen-reader pass of the report and the docs, recorded in the release notes.

## Facts and claims

- [x] Competitors re-checked with sources (`apps/docs/.../concepts/comparison.md`, 2026-11-03). Re-check again in the week of launch.
- [ ] Every number and legal date in README, docs and posts has a source, re-checked in the week of launch (WHO, ICSE 2020, EAA, DOJ Title II).
- [x] No "compliant", "certified" or "100%" claims: on 2026-11-04, `grep -riE "complian|certif|100%"` over README, docs site, report and CLI found only denials ("never certifies compliance") and CSS widths. Repeat in the week of launch.
- [ ] **F** Trademark search for "Pragu" (EUIPO TMview), and the result noted.

## Security and privacy

- [x] **F** Private vulnerability reporting turned on (SECURITY.md depends on it): on, checked with the GitHub API on 2026-11-04.
- [x] Threat model reviewed for the GitHub Action and the release pipeline (D-38), 2026-11-03: `docs/security/threat-model.md`, with a test that app text cannot inject Markdown or HTML into the comment.
- [x] `--redact` checked on a real report (five rn-shop screens on the emulator, 2026-11-03): none of the app texts checked is left in the HTML or JSON.
- [ ] The release APK has no INTERNET permission (`verifyReleaseNoInternetPermission` in the release workflow).

## Release

- [x] **F** `@pragu` npm organisation (2026-11-04).
- [x] **F** Trusted publishing for `pragu`, `@pragu/core`, `@pragu/report` (ADR-013).
- [x] **F** Release keystore and its four secrets (2026-11-04).
- [x] `pnpm changeset version`, review `CHANGELOG.md`, tag `v0.1.0`; the release workflow is green; `v0` tag moved to it for the action (2026-11-04).
- [ ] npm shows provenance on all three packages; the GitHub Release has the APK, `SHA256SUMS` and the SBOM.
- [x] Each package has a README (npm shows it); `pnpm package:check` installs the packed tarballs with npm into an empty folder and runs them, in CI on Linux, Windows and macOS.

## Docs and community

- [x] **F** GitHub Pages on, `DOCS_DEPLOY` set; the site is live at https://florentlatifi.github.io/Pragu/ (2026-11-04; home, getting started, a rule page and the comparison answer 200).
- [x] **F** The code of conduct's contact is set (2026-11-04).
- [ ] README: a report screenshot (done, `docs/images/report.png`), what checks miss (done); still to do: the quickstart from npm once published, and a link to the comparison page once the docs are live.
- [ ] "good first issue" labels on a few owner-task-sized issues.

## Launch

- [ ] **F** Three design partners have run Pragu on a test build (F-7 protocol).
- [ ] **F** Posts reviewed and approved (`docs/launch/posts.md`): nothing is posted without Florent.
- [ ] **F** Launch day chosen when Florent can answer comments for two days.

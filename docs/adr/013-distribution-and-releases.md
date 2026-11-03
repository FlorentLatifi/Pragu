# ADR-013: Distribution and releases

- Status: Accepted (2026-11-03, decided on Florent's instruction; see `docs/decisions.md`). Implement in M2.
- Date: 2026-11-03

## Context

v0.1 must install with one command (`npx pragu`), work offline, and be trustworthy: the agent it installs holds `UiAutomation` and can read every screen. The brief asks for SemVer with Changesets, npm provenance, a signed APK, a CycloneDX SBOM per release, and signing keys only in CI secrets.

## Decision

- **Packages:** `pragu` (the CLI), `@pragu/core` and `@pragu/report`, published together with one shared version (Changesets, fixed mode), 0.x until 1.0. The core and report READMEs say "internal until 1.0: no API promise".
- **The agent ships inside the `pragu` tarball** (663 KB unminified today). The build writes the APK's SHA-256 into the CLI, and the CLI checks it before every install. The CLI never downloads anything at run time.
- **Install only when needed:** skip `adb install` when the device already has the bundled version with the same checksum. An agent signed with another key is uninstalled and reinstalled (already implemented); the agent keeps no data.
- **Signing:** Florent creates the release keystore and stores it only in GitHub secrets. Tag builds are signed in CI; local and pull-request builds keep the debug key. Losing or rotating the key costs one reinstall per device, nothing more.
- **Versions:** the agent's `versionName` equals the CLI version. The protocol version is still checked in `hello`.
- **Release workflow,** on a version tag:
  1. lint, typecheck, test, bench, report accessibility check, and agent build with the no-INTERNET check;
  2. sign the APK and copy it into the CLI package;
  3. `pnpm pack` each package, which rewrites `workspace:` ranges;
  4. `npm publish` each tarball with npm trusted publishing (OIDC, npm CLI 11.5.1 or newer), which adds provenance automatically from a public repository;
  5. a GitHub Release with the APK, SHA-256 sums and a CycloneDX SBOM (`pnpm sbom --sbom-format cyclonedx --prod`, built into pnpm since 11.0).
- **First publish:** npm configures trusted publishers in a package's settings. If a brand-new name cannot be configured before it exists, Florent publishes the first version by hand with 2FA, then CI takes over. Check this when the time comes.

## Why

- One `npx pragu` and nothing fetched at run time keeps Pragu local-first and usable on locked-down CI.
- Provenance plus the in-CLI checksum means a user can trace the agent on their device to a CI build of a tagged commit.
- Lockstep versions keep "which core does this CLI use?" a non-question.

## Alternatives

- One bundled package: fewer names, but needs a bundler dependency. Revisit if install time or size becomes a complaint.
- Downloading the APK from GitHub Releases at run time: a network request and a second trust point.
- A long-lived npm token in secrets: works everywhere, but a token is a secret that can leak; OIDC tokens live for minutes.

## Sources

- npm trusted publishing: https://docs.npmjs.com/trusted-publishers
- `pnpm sbom`: https://pnpm.io/cli/sbom

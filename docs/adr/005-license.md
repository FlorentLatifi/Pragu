# ADR-005: Apache-2.0 with DCO sign-off

- Status: Accepted
- Date: 2026-10-27

## Decision

Pragu is licensed under the Apache License 2.0. Contributions are accepted under the Developer Certificate of Origin: each commit carries a `Signed-off-by:` line (`git commit -s`).

## Why

- It matches Google's Accessibility Test Framework for Android (Apache-2.0), which Pragu may reuse.
- The explicit patent grant matters to companies that run tools in their CI.
- It is permissive enough for agencies and banks to adopt it without legal review.
- DCO is lighter than a CLA: no signatures to collect, and contributors keep their copyright.

## Consequences

- A `NOTICE` file is needed once Pragu bundles or redistributes Apache-2.0 code that has one.
- A DCO check on pull requests is added with the contribution guidelines in M2.

## Sources

- Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0
- Developer Certificate of Origin: https://developercertificate.org/
- ATF licence: https://github.com/google/Accessibility-Test-Framework-for-Android

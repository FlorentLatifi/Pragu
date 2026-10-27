# Contributing to Pragu

Thank you for helping make apps easier to use for everyone.

## Before you open a pull request

1. **Sign off every commit** (Developer Certificate of Origin): `git commit -s`. It adds `Signed-off-by: Your Name <email>` and certifies you may contribute the change under Apache-2.0. See https://developercertificate.org/.
2. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): …`, `fix(cli): …`, `docs: …`.
3. Run the checks: `pnpm lint && pnpm typecheck && pnpm test`. Agent changes also need `pnpm agent:build`.
4. Explain any new dependency in one line, with the alternative you considered.

## Adding or changing a rule

A rule is done when it has:

- full metadata: WCAG 2.2 criteria, EN 301 549 clause, who is affected, what they experience, and fixes for React Native, Compose and Android Views;
- tests for what it flags and what it must not flag;
- a barrier and a correct twin in a fixture, with `expected.json` updated.

Precision matters more than recall: if a check cannot be confident, lower its confidence or stay silent.

## Code of conduct

Be kind and assume good intent. A full code of conduct (Contributor Covenant) arrives before the first public release.

# Changesets

Every pull request that changes what users get adds a changeset: `pnpm changeset`, pick the bump, write one line for the changelog. The three published packages (`pragu`, `@pragu/core`, `@pragu/report`) share one version (ADR-013). `pnpm changeset version` turns the changesets into versions and `CHANGELOG.md` entries before a release tag.

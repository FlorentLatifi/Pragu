## What and why

<!-- One or two sentences. Link the issue or ADR if there is one. -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`, Developer Certificate of Origin)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass (agent changes: `pnpm agent:build`)
- [ ] A changeset if users will notice the change (`pnpm changeset`)
- [ ] A new dependency is explained in one line, with the alternative considered
- [ ] A new or changed rule has metadata, tests for what it must and must not flag, and a fixture barrier with a correct twin

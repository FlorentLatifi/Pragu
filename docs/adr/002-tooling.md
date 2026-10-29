# ADR-002: Tooling

- Status: Accepted
- Date: 2026-10-27

## Decision

| Area | Choice | Why | Alternative |
|---|---|---|---|
| Package manager | pnpm 12.15.0 workspaces, pinned in `packageManager` | Strict `node_modules` catches a package that imports something it forgot to declare, before users installing from npm hit it. `workspace:` plus Changesets is the standard way to publish several packages. | npm workspaces, the default in Florent's other projects. Simpler, but hoisting hides missing dependencies. |
| Supply-chain guard | Keep pnpm's `minimumReleaseAge` on. Pin an older version rather than adding exclusions. | New releases are the window in which hijacked packages ship. | Exclusions, which pnpm offers to add automatically |
| Node | `>=22.13` for users; CI runs 22 and 24 | Matches React Native's own floor (22.11+). 22.13 is ESLint 10's floor. | Node 24 only |
| Language | TypeScript 6.0.3, strict, `noUncheckedIndexedAccess` | typescript-eslint 8.72 supports `typescript <6.1.0`; TypeScript 7.0 (native) cannot be type-linted yet. | TypeScript 7.0.2, after typescript-eslint supports it |
| Lint and format | ESLint 10 with `strictTypeChecked`, plus Prettier | Type-aware rules (floating promises, unnecessary conditions) matter in an async CLI. | Biome: faster, one tool, but weaker type-aware linting |
| Tests | Vitest 5 with v8 coverage; 90% gate on `packages/core` | Fast, ESM-native, file snapshots for golden reports | Jest |
| Runtime dependencies | `core` and `report`: none. `cli`: `pngjs` only | Decoding PNG screenshots is needed for contrast. pngjs is pure JS. | sharp (native binaries per platform), or a hand-written decoder (risky) |
| Android | Gradle 9.8.2 wrapper (distribution SHA-256 pinned, wrapper JAR checksum verified), AGP 9.4.1 with built-in Kotlin, Java 17 bytecode, JUnit 4.13.2 and org.json for JVM tests, Android Lint | Current stable versions, checked on 2026-10-27 | ktlint or detekt: added in M1, to keep M0 lean |
| Fixture app | Standalone npm project outside the workspace | It plays a user's app and must install like one | A workspace package |

## Notes

- In cmdline-tools 23, Google's new Android CLI collects usage metrics by default. Pragu's scripts and docs always pass `--no-metrics`.
- React Native builds need JDK 17 (its docs warn about newer JDKs). The agent builds with JDK 17 or newer.
- CI pins every GitHub Action to a full commit SHA.

## Amendment (2026-10-29)

Node 22.18 or newer: it strips TypeScript types by default, so `pragu.config.ts` loads without a loader dependency. Test-only dev dependencies: `ajv` (validates real results against the JSON Schema) and `fast-check` (property tests for issue fingerprints). Approved by Florent.

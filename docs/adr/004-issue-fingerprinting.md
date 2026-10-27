# ADR-004: Issue fingerprints for baselines

- Status: Proposed. M0 ships a placeholder. M1 implements this, with property tests.
- Date: 2026-10-27

## Context

Baselines let existing apps adopt Pragu: only *new* issues fail the build. That needs a way to say "this issue is the same one as last scan", even when a screen moved by a few pixels, a sibling was added, list items reordered, or unrelated text changed. The fingerprint must also change when the issue really is different: another element, or another rule.

## Decision

Two layers.

1. **Stable key**, hashed with FNV-1a 64: `rule id + app id + screen key + element key`.
   - Element key, in order of preference:
     1. Developer id: Android resource id or React Native `testID`.
     2. Accessibility identity: role plus accessible name.
     3. Structural path: roles from the root, with sibling positions counted per role. Pure layout containers are skipped, so wrapper changes do not matter.
   - Screen key: screen name (from title or route) when stable, otherwise a structural signature of headings and landmark roles.
2. **Fuzzy match** when diffing against a baseline. Issues without an exact key match are paired with the same rule on the same screen by highest similarity: name similarity, role, and overlap of their positions relative to the screen. A pairing needs a threshold score. The baseline stores the features, not just the hash.

## Properties to test (fast-check, M1)

- Invariant: translating every bound by a few dp, inserting an unrelated sibling, wrapping an element in a container, or changing unrelated text keeps the fingerprint.
- Sensitive: another rule, another element with its own id, or another screen changes it.
- Deterministic: the same capture always gives the same fingerprints.

## M0 placeholder

`issueFingerprint()` hashes rule, app, screen name, and either the resource id or role, name and text. It is stable for the fixture, but not under copy edits to unnamed elements.

# ADR-004: Issue fingerprints for baselines

- Status: Accepted. Layer 1 implemented in M1 (v1, below); layer 2 (fuzzy matching) is next.
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

## Implemented (v1, M1)

- `elementKey()` follows the order above: developer id, then role and accessible name, then a structural path of roles and same-role sibling positions that skips layout-only wrappers (containers with no name, id or action). `issueFingerprint()` hashes rule, app, screen name and that key.
- Property tests (fast-check, `packages/core/test/fingerprint.test.ts`) prove: deterministic; unchanged when everything moves on screen, when another element's text changes, and when an element is appended to any list; unchanged when an element with an id or a name is wrapped in a layout container; changed by another rule, screen, app or element id.
- **Not guaranteed yet:** an element with neither id nor name can change its fingerprint when a same-role sibling is inserted before it or when it is wrapped. Fuzzy matching (layer 2) is meant to absorb that.
- Baselines (`packages/core/src/baseline.ts`, version 1) match by fingerprint and store each issue's rule, screen, resource id and message, so layer 2 can be added without regenerating them.

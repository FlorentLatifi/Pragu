# Governance

Pragu is led by its founder and maintainer, **Florent Latifi**, who makes the final decision on scope, design and releases (a "benevolent dictator" model, D-41). It suits a project with one maintainer; it will change when there are others.

## How decisions are made

- Small changes: a pull request, reviewed and merged by the maintainer.
- Decisions that shape the project are written down: an ADR in `docs/adr/` for each, and the register in `docs/decisions.md`. Anyone may propose one in an issue.
- The founding brief (`docs/00-founding-brief.md`) sets the product's scope; what it leaves out goes to `ROADMAP.md`, not into the code.

## Principles every change is held to

- A false alarm is a bug: precision before recall.
- Nothing leaves the user's machine by default.
- No claims of "compliant", "certified" or "100%".
- Pragu's own report, docs and CLI meet WCAG 2.2 AA.

## Contributions

Contributions are welcome under the Apache License 2.0 with a Developer Certificate of Origin sign-off on every commit (`git commit -s`), checked on pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## Becoming a maintainer

When regular contributors appear, the maintainer will invite them as co-maintainers and revise this document, likely moving the repository to an organisation.

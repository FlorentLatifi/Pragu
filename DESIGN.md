# DESIGN.md (Pragu)

Overrides the global design defaults for this project. Applies to the HTML report and anything that grows from it (PR comments, a future web view). Chosen by Florent on 2026-10-29: direction **Signal**, with Drafting table's measurement labels (`docs/design/`).

## Identity

- **Who:** a developer who opens the report from a failed PR check. Within seconds they must see which barrier they added, where it is on the screenshot, and the fix.
- **Direction:** wayfinding signage. Black and yellow plates, calm surfaces, nothing decorative. The report practises what it checks.
- **Memorable detail:** numbered black-on-yellow plates on the screenshot that carry the measurement ("16 × 16 dp", "2.52 : 1", "no name"): the evidence sits on the screen itself.

## Tokens

Defined once in `packages/report/src/theme.ts`; components use only the CSS variables. A test checks every text pair at 4.5:1 and every plate edge and focus ring at 3:1, in both themes, with Pragu's own contrast function.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #0D0D0D | Page |
| `--surface` | #F4F4F1 | #191919 | Issue cards, screenshot frame |
| `--ink` | #101010 | #F6F6F2 | Text, error tags |
| `--muted` | #474747 | #B8B8B1 | Secondary text |
| `--line` | #D4D4CE | #333333 | Dividers only |
| `--signal` | #FFD400 | #FFD400 | The one accent. **Fill only**, always behind `--on-signal` text |
| `--on-signal` | #101010 | #101010 | Text on yellow |
| `--halo` | #101010 | #101010 | Outline that keeps plates visible on light screenshots |
| `--focus` | #101010 | #FFD400 | Focus ring |

- **Type:** Atkinson Hyperlegible Next for text, Atkinson Hyperlegible Mono for numbers, ids and code. Embedded (OFL), never loaded from the network. Scale 12, 14, 16, 20, 28, 40. Body 16 / 1.6.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48, 64.
- **Radius:** 0 on plates and screenshot frames (signs are square), 6 px on cards and buttons. Two values.
- **Severity** is spelled out and shaped, never coloured: Error is a solid ink tag, Warning an outlined tag, Info a muted outline.
- **Separation:** surfaces by background only. No shadows, no card borders.

## Never

Everything on the global "Never" list, plus: no second accent colour, no yellow text, no colour-only meaning, no network requests from the report.

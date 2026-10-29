# Designing Pragu together

The report is the product's face: it's what people screenshot and share. This is how Florent and Claude design it, so the result has a point of view and stays accessible.

## The brief, in three lines

1. **Who and what, fast:** a developer opens the report from a failed PR check and must see within seconds which barrier they added, where it is on the screen, and the fix.
2. **Direction:** precise, editorial, architectural-drawing. One strong accent, grotesk + mono type, numbered callouts like a technical drawing.
3. **The memorable detail:** depends on the direction we pick; each tile names one.

## The loop

| Step | Who | Output |
|---|---|---|
| 1. Directions | Claude | [`directions.html`](directions.html): 3 style tiles built from a real scan, light and dark, contrast measured |
| 2. React | Florent | Pick one, or point at parts to mix ("A's callouts with C's colours"). Comment in chat by direction and element. |
| 3. Converge | Both | One direction refined on the real report, in a few rounds of edit, refresh, comment |
| 4. Lock | Claude | Tokens in `packages/report/src/theme` and a project `DESIGN.md` that overrides the global defaults |
| 5. Build | Both | Report v1 in M1 (ADR-003). `pnpm design` serves sample results with hot reload, so a design session is live changes in the browser pane |
| 6. Check | CI | Contrast test over every token pair, axe-core, keyboard walk-through, print to PDF, screen reader before release |

## Decision

Direction **B, Signal**, with **A's measurement labels** on the callouts ("16 × 16 dp", "2.52 : 1"). Chosen by Florent on 2026-10-29. Next: converge on the real report, then lock the tokens.

## Rules that do not bend

- WCAG 2.2 AA in both themes: text ≥ 4.5:1, UI parts and callouts ≥ 3:1 against both light and dark app screenshots, hence the halo on every callout.
- Never colour alone: severity is spelled out, numbers link markers to issues.
- One self-contained file: fonts get embedded (OFL licences) once a direction is chosen; no network requests.
- No template look: no purple gradients, no emoji icons, no glassmorphism, no shadow-plus-border-plus-radius on every card, no Inter, Roboto or Space Grotesk.

## Viewing the directions

Open `docs/design/directions.html` in a browser. The tiles load fonts from Google Fonts, so they need a connection; the real report will not. Toggle the theme with the button at the top.

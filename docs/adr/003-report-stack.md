# ADR-003: Report stack

- Status: Accepted, amended 2026-10-29: report v1 keeps the typed templates (see Amendment).
- Date: 2026-10-27

## Context

The HTML report is the product's face. It must be one file that works offline and makes no network requests. It must be keyboard- and screen-reader-accessible (WCAG 2.2 AA), print cleanly to PDF, and support light and dark themes. In M1 it gains screen, rule and diff views, filtering and a transcript. Florent will co-design it, so iterating on the design has to be fast.

## Decision

- **M0:** typed template functions in `@pragu/report`, no dependencies. Enough for the walking skeleton, and fully testable as a golden file.
- **M1 (proposed):** Preact with Vite and a single-file build plugin.
  - The template is built once, when the package is built.
  - At scan time the CLI only injects the result JSON into a `<script type="application/json">` tag. Rendering stays deterministic and fast, with no bundler at runtime.
  - Florent already writes React, so he can contribute to the report.
  - `pnpm design` runs Vite's dev server with sample results and hot reload. That is the tool for co-designing the report.

## Consequences

- Preact adds about 4 kB to each report. Screenshots dominate the size, so M1 also decides on WebP: a WASM encoder versus downscaled PNG, measured against the report-size budget.
- The golden tests carry over: render with fixed data, compare to a committed file.

## Alternatives

- Svelte: small output, but a second component model to learn.
- Lit or web components: standard, but more boilerplate for this much UI.
- Plain templates forever: fine for M0, too costly for filters and views.

## Amendment (2026-10-29): report v1 stays on typed templates

Report v1 was built in the chosen design direction (Signal, DESIGN.md) without Preact or Vite, with Florent's approval.

- The report is still static: one page, a theme toggle and anchor links. Nothing yet needs components or client-side state.
- Zero dependencies keeps the supply chain small, the output deterministic, and the golden test simple.
- Design sessions work without a dev server: `pragu scan --from-capture` re-renders a real recording in a second, and `node scripts/serve-reports.mjs` serves it in the browser pane.
- Fonts (Atkinson Hyperlegible Next and Mono, OFL) are embedded by `scripts/embed-fonts.mjs` into a generated module, so the report stays one offline file.

Revisit when the report gains filters, rule and diff views (baselines, M2). The Preact plan above remains the default then.

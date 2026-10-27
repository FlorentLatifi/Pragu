# ADR-003: Report stack

- Status: M0 accepted. M1 proposed, to be confirmed with the design direction.
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

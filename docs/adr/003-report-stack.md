# ADR-003: Report stack

- Status: Accepted, amended 2026-10-29: report v1 keeps the typed templates, including its views (see Amendments).
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

## Amendment (2026-10-29): views and filters without a framework

The rule index, the baseline diff and the filters landed in M1, still on typed templates (plan approved by Florent).

- The views are server-rendered HTML: the rule index links to the numbered cards instead of repeating them, and the diff is a list. Neither needs client-side state.
- The filters are about 30 lines of plain JavaScript that toggle `hidden` and one class. The form starts hidden, so without scripts every issue shows and no dead control appears.
- The `pnpm design` playground is dropped: re-rendering a recording and serving `reports/` covers design sessions.
- `scripts/check-report-a11y.mjs` (`pnpm report:a11y`, CI) runs axe-core (WCAG 2.2 A/AA) in Chrome on real reports: light and dark, phone and desktop, filtered and not, and checks that the filters do what they say. It uses `playwright-core` with the browser already on the runner. Its first run found three real problems (screenshot markers under 24 px, markers overlapping, sign names not containing their visible text); the numbered signs are now the links and the outlines only drawings.

Revisit when the report needs real client-side state: several screens with navigation (M3 flows), sorting, or search. Preact remains the first candidate then.

---
'pragu': patch
---

Pull requests are compared with the main branch's latest completed scan, even when that scan found barriers, instead of listing every existing barrier as new. `pragu init --github` writes a workflow pinned to this Pragu version, scans pushes with `--fail-on never`, and writes SARIF on public repositories only. The action runs the Pragu version it was released with. SARIF results with no source line now point at a committed project file instead of report output.

---
'pragu': patch
---

The pull-request comment shows "Likely here: `path:line`" under a barrier when exactly one line of source in the repository names the element's id (D-43, tier 1). `pragu comment` gets `--source-root` (default: the current directory); nothing is shown when no line, or more than one, matches. Unreadable folders and symbolic links are skipped, and a `--source-root` that is not a folder is a usage error.

---
'pragu': patch
'@pragu/core': patch
'@pragu/report': patch
---

`--redact` no longer leaks app text: text behind a card-sized dialog is covered in the screenshot, app text containing quotes is replaced in messages, a screen named after its window title becomes `Screen N`, and Pragu's own role words stay in either case. `pragu baseline create` and `update` refuse a redacted result.

# ADR-010: Text field labels: report missing names now, placeholder-only labels later

- Status: Accepted
- Date: 2026-10-28

## Context

`input/missing-label` was planned to catch fields labelled only by a placeholder. The recordings show that a passive scan cannot see that problem reliably:

- **React Native and Views** expose a placeholder as the field's `hintText`. TalkBack keeps reading the hint after the user types, so the field still has a programmatic label. The barrier is visual: the words vanish from view. Material's `TextInputLayout`, common in Views apps, looks exactly the same in the tree, yet its floating label stays visible. Flagging "hint only" would raise a false alarm on every such field.
- **Compose** exposes a field's label and its placeholder as the same kind of child text. While the field is empty they are indistinguishable. After typing, the label stays and the placeholder disappears from view and from the tree. Telling them apart needs the field filled in.

A field with **no name at all** is unambiguous: TalkBack says only "Edit box". One case would look like it but is not: a field named by another element through `android:labelFor` or React Native's `aria-labelledby`. Protocol 2 did not capture that relation.

## Decision

1. **Protocol 3** adds `labeledBy` to every node: the words of the element that labels it (`AccessibilityNodeInfo.getLabeledBy()`).
2. A text field's name is its content description, then its `labeledBy` label, then its hint, then (Compose) the label text inside it. Its own text is its value, never its name.
3. **`input/missing-label`** (error, high confidence) reports visible text fields that have no name at all. The message names the visible text right above or beside the field, if any, because that is usually the label someone forgot to connect.
4. **Placeholder-only labels** become a rule of their own, `input/placeholder-label`. It is labelled in both fixtures now and implemented once Pragu can type into fields during a crawl (M3) and see what stays.

## Consequences

- A hint-only field (React Native placeholder, Views `TextInputLayout`) is never reported by `input/missing-label`. The rn-shop placeholder field is labelled a correct twin for it, which guards that property.
- The Compose placeholder field goes unreported until `input/placeholder-label` exists; the bench lists it as awaiting that rule.
- Captures from protocol 2 are rejected with advice to reinstall the agent. All bench recordings were re-recorded.

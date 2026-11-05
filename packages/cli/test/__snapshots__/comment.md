<!-- pragu-comment -->
### Pragu · 1 new barrier in this pull request

**Interactive element has no accessible name** · Error · WCAG 4.1.2 · 1 new

- Shop › `seed-unlabeled-remove`: This button has no accessible name. A screen reader can only announce "Button".
  Screen reader says: "Unlabelled, Button"

<details><summary>How to fix</summary>

- React Native: Describe the action with accessibilityLabel, e.g. \<Pressable accessibilityLabel="Remove item"\>.
- Jetpack Compose: Give the icon a contentDescription, or add Modifier.semantics { contentDescription = "Remove item" }.
- Android Views: Set android:contentDescription="@string/remove\_item" on the button or ImageButton.

</details>

Pragu score 86 → 75 · 1 screen checked · 2 known issues not listed (compared with the latest scan of the main branch) · Full report: [pragu-report](https://github.com/o/r/actions/runs/1) · Automated checks find some barriers, not all; test with TalkBack too.

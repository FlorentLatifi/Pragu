# Labelling protocol for the real-app bench

Decided in ADR-015. The labels are the ground truth that Pragu's public precision and recall rest on, so they are made **blind**: on each screen, labels come before any look at what Pragu reports there.

## 1. Choosing apps

- Open source, with a licence that allows redistribution (screenshots are committed): note it in `expected.json` with the source URL.
- Mix the toolkits (Views, Compose, React Native, Flutter if available) and categories the EAA covers: shopping, reading, transport, money tools.
- No proprietary app, and no design partner's app, ever enters the repository.
- Before choosing, assign each app to `dev` or `test` by alternating in the order chosen, and write it down. Never move an app between halves afterwards.

## 2. Recording a screen

1. Install the app on the emulator (each APK download is approved by Florent first), with test data only: no real account.
2. Navigate to the screen by hand.
3. `node bench/dist/cli.js record-real --app <folder> --package <applicationId> --screen <id>` (add `--large-text` for the 200% capture). It saves `bench/real/<folder>/recordings/<id>.json|png` and a labelling page, `<id>.label.html`.
4. Check the screenshot shows the intended screen, with no personal data. Delete and record again otherwise.

## 3. Labelling, blind

Do not run `pragu scan`, the bench or any other checker on the screen until its labels are committed. Open the labelling page (it shows the tree and the screenshot, nothing Pragu found) and, for **every rule** in the rule menu:

- **Barrier**: the element fails that rule's success criterion, judged by these checks:
  - names and states: TalkBack on a phone, with "Display speech output" on, swiping through the screen;
  - contrast: the text and background colours read from the screenshot's pixels with a colour picker, ratio computed with the WCAG formula;
  - target size: the element's bounds in dp, with WCAG 2.5.8's spacing exception;
  - text at 200%: the large-text capture, read by eye.
- **Correct**: the rule applies to the element and it passes.
- Unmarked: the rule does not apply.

When unsure, write why in a `note` on the label and leave the decision for the second labeller.

Copy the page's JSON into the screen's entry in `expected.json`, and commit the labels on their own, before any evaluation:

```json
{
  "app": "notes",
  "appId": "org.example.notes",
  "split": "dev",
  "license": "GPL-3.0-only",
  "source": "https://f-droid.org/packages/org.example.notes/",
  "screens": [{ "id": "list", "name": "Note list", "barriers": [], "correctTwins": [] }]
}
```

## 4. A second labeller

At least 20% of screens, picked at random across apps, are labelled again by a second person using this protocol, without seeing the first labels. Cohen's kappa per rule is reported next to the results. Disagreements are settled by discussion, and the settled label is the one kept, with a note.

## 5. Evaluation

- `node bench/dist/cli.js evaluate --real dev` scores the dev half; rules may be tuned against it.
- `node bench/dist/cli.js evaluate --real test` scores the held-out half. Run it only for a release, and publish what it says, with counts and Wilson 95% intervals. A rule tuned after seeing test results makes that test half dev data: record it, and label new test apps.

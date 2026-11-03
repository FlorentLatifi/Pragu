# Launch posts: drafts for Florent's approval

Drafts only. Nothing is posted until Florent reads, edits and approves each one, and the numbers in them are re-checked in the week of launch. Placeholders are in brackets.

## Show HN

**Title:** Show HN: Pragu – open-source accessibility checks for Android apps, on every pull request

**Text:**

I'm Florent, a developer in Prishtina. Pragu scans your Android app on an emulator, finds accessibility barriers such as unlabelled buttons, low contrast, small targets and text cut off at 200%, and tells you who each one hurts and how to fix it in React Native, Compose or Views.

A few choices that may be interesting:

- It needs no changes to your app: an instrumentation APK reads the accessibility tree and a screenshot over adb. The agent has no network permission, and a build check enforces that.
- Rules run in TypeScript on your machine. A false alarm counts as a bug: every rule's precision is measured on labelled screens and published with its counts, including the misses.
- The GitHub Action comments only the barriers a pull request adds, compared with the default branch's last scan, and redacts app text on public repositories.

It's Android-only and pre-1.0. Automated checks catch some barriers, not all, and the report says so.

Repo: https://github.com/FlorentLatifi/Pragu · Docs: [docs URL]

## r/reactnative

**Title:** I built an open-source tool that finds accessibility barriers in React Native apps on every PR

**Text:**

Pragu scans your app on an Android emulator and reports what TalkBack users and others would hit: a pressable with no `accessibilityLabel`, a custom checkbox that never says it's checked, pale text, tiny targets. Each issue has the fix in React Native terms.

- Works with Expo: list your screens by deep link in `pragu.config.ts`, and one scan checks them all.
- A GitHub Action comments only what your PR adds.
- `hitSlop` is invisible to accessibility tools, so the target-size rule stays a warning: it can't see what `hitSlop` adds.

Feedback from people shipping RN apps would help a lot, especially false alarms. [docs URL]

## Expo community

**Title:** Accessibility checks for Expo apps, by deep link, no code changes

**Text:**

Expo Router gives every screen a deep link, and Pragu uses them: list your routes in a config file, run one command on an emulator, and get a report of the accessibility barriers on each screen, with who they affect and the fix. It's open source and runs locally. I'd love to hear where it falls short on your app. [docs URL]

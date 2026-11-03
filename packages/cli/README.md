# pragu

**Find the accessibility barriers in your Android app before your users hit them.** Pragu scans your app on an emulator or phone, reads what TalkBack sees plus a screenshot, and reports each barrier with who it hurts, what they experience, and the fix in React Native, Jetpack Compose or Android Views.

```bash
npx pragu doctor
npx pragu scan --app com.example.shop
```

- No changes to your app. Pragu installs a small agent over adb that has no network permission, ever.
- Several screens in one scan: list them with their deep links in `pragu.config.ts` (`npx pragu init` writes one).
- One offline HTML report, a versioned JSON result, and SARIF for GitHub code scanning (`--format sarif`).
- Baselines, so an existing app fails only on new barriers; `--redact` for reports you share.
- A GitHub Action that comments only the barriers a pull request adds.

Pragu runs automated checks. It finds some barriers, not all, and never certifies compliance.

Docs: https://florentlatifi.github.io/Pragu/ · Source and issues: https://github.com/FlorentLatifi/Pragu · Apache-2.0

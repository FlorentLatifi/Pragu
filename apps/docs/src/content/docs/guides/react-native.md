---
title: React Native and Expo
description: Deep links to each screen, testIDs Pragu can name, and the fixes it suggests.
---

Pragu reads your app through Android's accessibility tree, the same one TalkBack uses, so it needs nothing in your code. Three things make its reports better.

## Deep links to your screens

To check several screens in one scan, Pragu opens each one by deep link on a fresh start. With Expo Router every route already has one: `myapp://cart` opens `app/cart.tsx` once `scheme` is set in `app.json`. With React Navigation, configure [linking](https://reactnavigation.org/docs/deep-linking/). Check a link by hand first:

```bash
adb shell am start -a android.intent.action.VIEW -d 'myapp://cart' com.example.shop
```

Use test data and a build that starts signed in to a test account.

## testIDs

A `testID` reaches Android as the view's resource id. Pragu shows it next to each issue (`seed-unlabeled-remove`), so you can search your code for it, and baselines use it to recognise the same issue after a layout change. Give one to every control you want to find quickly.

## What gets flagged, and the usual fix

| Issue | Usual React Native fix |
|---|---|
| A pressable icon with no name | `accessibilityLabel="Remove item"` |
| A custom checkbox that never says it is checked | `accessibilityRole="checkbox"` with `accessibilityState={{ checked }}` |
| A small icon button | `minWidth`/`minHeight` of 48, or padding. `hitSlop` enlarges the touch area, but Pragu cannot see it yet, so the issue stays a warning |
| Pale text | a darker colour, until the ratio reaches 4.5:1 |

Every issue in the report carries the fix for React Native, Jetpack Compose and Android Views.

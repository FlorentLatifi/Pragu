# Report fonts

Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, designed for readers with low vision (Braille Institute, Applied Design Works). SIL Open Font License 1.1; the licence texts are next to the fonts.

Latin subsets, weights 400 and 700, taken from the Fontsource npm packages `@fontsource/atkinson-hyperlegible-next@5.3.0` and `@fontsource/atkinson-hyperlegible-mono@5.3.0`.

The report embeds them so it stays one offline file. After changing a font, regenerate `packages/report/src/fonts.ts` with `node scripts/embed-fonts.mjs`.

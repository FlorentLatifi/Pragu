// Design tokens for the report: direction "Signal" (docs/design/, DESIGN.md). Wayfinding
// signage: black and yellow plates that stay readable on any app screenshot, calm
// surfaces around them. Yellow is only ever a fill behind black text.

export interface ThemeTokens {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  /** The one accent, used as a fill only, always with `onSignal` text. */
  signal: string;
  onSignal: string;
  /** The dark outline that keeps plates and frames visible on light screenshots. */
  halo: string;
  focus: string;
}

export const LIGHT: ThemeTokens = {
  bg: '#ffffff',
  surface: '#f4f4f1',
  ink: '#101010',
  muted: '#474747',
  line: '#d4d4ce',
  signal: '#ffd400',
  onSignal: '#101010',
  halo: '#101010',
  focus: '#101010',
};

export const DARK: ThemeTokens = {
  bg: '#0d0d0d',
  surface: '#191919',
  ink: '#f6f6f2',
  muted: '#b8b8b1',
  line: '#333333',
  signal: '#ffd400',
  onSignal: '#101010',
  halo: '#101010',
  focus: '#ffd400',
};

/** Text and background pairs the report draws; each must reach 4.5:1 (tested). */
export const TEXT_PAIRS: readonly (readonly [keyof ThemeTokens, keyof ThemeTokens])[] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['onSignal', 'signal'],
  ['bg', 'ink'],
];

/** Non-text pairs that must reach 3:1 (WCAG 1.4.11): focus rings and plate edges. */
export const UI_PAIRS: readonly (readonly [keyof ThemeTokens, keyof ThemeTokens])[] = [
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['halo', 'signal'],
];

function variables(tokens: ThemeTokens): string {
  const names: Record<keyof ThemeTokens, string> = {
    bg: '--bg',
    surface: '--surface',
    ink: '--ink',
    muted: '--muted',
    line: '--line',
    signal: '--signal',
    onSignal: '--on-signal',
    halo: '--halo',
    focus: '--focus',
  };
  return (Object.keys(names) as (keyof ThemeTokens)[]).map((key) => `${names[key]}: ${tokens[key]};`).join(' ');
}

/** Light by default, dark when the system asks or the reader chooses it; the toggle wins. */
export function themeCss(): string {
  return `:root { ${variables(LIGHT)} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${variables(DARK)} color-scheme: dark; } }
:root[data-theme="dark"] { ${variables(DARK)} color-scheme: dark; }`;
}

// Pragu's docs site (D-39): Astro Starlight, static, on GitHub Pages. No analytics; search is
// Pagefind, built into the site and run in the reader's browser.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  site: 'https://florentlatifi.github.io',
  base: '/Pragu',
  // The Atkinson Hyperlegible fonts are the report's own files (packages/report/fonts).
  vite: { server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } } },
  integrations: [
    starlight({
      title: 'Pragu',
      description: 'Find the accessibility barriers in your mobile app before your users hit them.',
      customCss: ['./src/styles/signal.css'],
      // Wrapped lines: a code block that scrolls sideways cannot be reached with a keyboard (axe, WCAG 2.1.1).
      expressiveCode: { defaultProps: { wrap: true } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/FlorentLatifi/Pragu' }],
      sidebar: [
        { label: 'Start', items: ['getting-started', 'guides/react-native', 'guides/ci'] },
        { label: 'Understand', items: ['concepts/what-checks-miss', 'concepts/baselines', 'concepts/evidence', 'concepts/comparison', 'accessibility-101'] },
        { label: 'Reference', items: ['reference/cli', 'reference/config', { label: 'Rules', items: [{ autogenerate: { directory: 'rules' } }] }] },
        { label: 'More', items: ['faq'] },
      ],
    }),
  ],
});

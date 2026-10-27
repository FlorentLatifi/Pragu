import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The CLI package version, read at runtime so dist/ and tests agree without a build step. */
export function toolVersion(): string {
  return (require('../package.json') as { version: string }).version;
}

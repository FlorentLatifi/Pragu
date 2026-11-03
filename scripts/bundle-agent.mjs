// Copies the built agent APK into the CLI package with its SHA-256, so the published CLI
// installs exactly the agent CI built and refuses a changed file (ADR-013).
// Usage: pnpm agent:build && node scripts/bundle-agent.mjs [path-to-signed.apk]
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source =
  process.argv[2] ??
  fileURLToPath(new URL('../agents/android/agent/build/outputs/apk/release/agent-release.apk', import.meta.url));
const dir = fileURLToPath(new URL('../packages/cli/agent/', import.meta.url));
await mkdir(dir, { recursive: true });
await copyFile(source, `${dir}pragu-agent.apk`);
const sum = createHash('sha256')
  .update(await readFile(source))
  .digest('hex');
await writeFile(`${dir}pragu-agent.sha256`, `${sum}  pragu-agent.apk\n`);
console.log(`Bundled ${source}\nSHA-256 ${sum}`);

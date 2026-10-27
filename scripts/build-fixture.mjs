// Builds the rn-shop fixture as a release APK: expo prebuild, then Gradle.
// Usage: pnpm fixture:build   (env PRAGU_FIXTURE_ABIS overrides the default x86_64 emulator ABI)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureDir = fileURLToPath(new URL('../fixtures/rn-shop/', import.meta.url));
const androidDir = fileURLToPath(new URL('../fixtures/rn-shop/android/', import.meta.url));
const isWindows = process.platform === 'win32';
const abis = process.env.PRAGU_FIXTURE_ABIS ?? 'x86_64';

// Gradle disables a whole repository after one failed request, so a single dropped
// DNS lookup on a flaky network kills a 20-minute build. Caching successful lookups
// for the life of each JVM removes all but the first lookup per host.
const env = {
  ...process.env,
  CI: '1',
  JAVA_TOOL_OPTIONS: process.env.JAVA_TOOL_OPTIONS ?? '-Dsun.net.inetaddr.ttl=-1 -Dsun.net.inetaddr.negative.ttl=0',
};

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  // Windows can only start .bat/.cmd files through a shell.
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWindows, env });
  if (result.status !== 0) {
    console.error(`\nFailed: ${command} ${args.join(' ')} (exit ${result.status ?? 'signal'})`);
    process.exit(result.status ?? 1);
  }
}

if (!process.env.ANDROID_HOME) {
  console.error('ANDROID_HOME is not set. Point it at your Android SDK, e.g. %LOCALAPPDATA%\\Android\\Sdk on Windows.');
  process.exit(3);
}

if (!existsSync(new URL('../fixtures/rn-shop/node_modules/', import.meta.url))) {
  run('npm', ['ci'], fixtureDir);
}
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], fixtureDir);
// Absolute path: cmd.exe does not reliably search the working directory for gradlew.bat.
run(
  join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew'),
  ['assembleRelease', `-PreactNativeArchitectures=${abis}`],
  androidDir,
);
console.log('\nAPK: fixtures/rn-shop/android/app/build/outputs/apk/release/app-release.apk');

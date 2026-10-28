// Builds the fixture apps as release APKs.
// Usage: pnpm fixture:build [rn-shop] [android-compose]   (both when none is named)
// Env PRAGU_FIXTURE_ABIS overrides rn-shop's default x86_64 emulator ABI.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Absolute path: cmd.exe does not reliably search the working directory for gradlew.bat.
function gradle(projectDir, args) {
  run(join(projectDir, isWindows ? 'gradlew.bat' : 'gradlew'), args, projectDir);
}

function buildRnShop() {
  const fixtureDir = fileURLToPath(new URL('../fixtures/rn-shop/', import.meta.url));
  if (!existsSync(join(fixtureDir, 'node_modules'))) {
    run('npm', ['ci'], fixtureDir);
  }
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], fixtureDir);
  gradle(join(fixtureDir, 'android'), ['assembleRelease', `-PreactNativeArchitectures=${abis}`]);
  console.log('\nAPK: fixtures/rn-shop/android/app/build/outputs/apk/release/app-release.apk');
}

function buildCompose() {
  gradle(fileURLToPath(new URL('../fixtures/android-compose/', import.meta.url)), ['assembleRelease']);
  console.log('\nAPK: fixtures/android-compose/app/build/outputs/apk/release/app-release.apk');
}

const builders = { 'rn-shop': buildRnShop, 'android-compose': buildCompose };

if (!process.env.ANDROID_HOME) {
  console.error('ANDROID_HOME is not set. Point it at your Android SDK, e.g. %LOCALAPPDATA%\\Android\\Sdk on Windows.');
  process.exit(3);
}
const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !Object.hasOwn(builders, name));
if (unknown.length > 0) {
  console.error(`Unknown fixture: ${unknown.join(', ')}. Choose from: ${Object.keys(builders).join(', ')}.`);
  process.exit(2);
}
for (const name of requested.length > 0 ? requested : Object.keys(builders)) {
  builders[name]();
}

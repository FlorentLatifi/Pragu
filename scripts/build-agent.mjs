// Builds the Android agent APK, runs its unit tests and checks that it requests no network access.
// Usage: pnpm agent:build   (needs JDK 17+ in JAVA_HOME and the Android SDK in ANDROID_HOME)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const agentDir = fileURLToPath(new URL('../agents/android/', import.meta.url));
const isWindows = process.platform === 'win32';
const gradlew = join(agentDir, isWindows ? 'gradlew.bat' : 'gradlew');
// AGP 9 creates JVM unit tests for the debug build type only. Lint catches API-level crashes (NewApi).
const tasks = [
  ':agent:assembleRelease',
  ':agent:testDebugUnitTest',
  ':agent:lintRelease',
  ':agent:verifyReleaseNoInternetPermission',
];

// See build-fixture.mjs: one dropped DNS lookup otherwise disables a whole Maven repository.
const env = {
  ...process.env,
  JAVA_TOOL_OPTIONS: process.env.JAVA_TOOL_OPTIONS ?? '-Dsun.net.inetaddr.ttl=-1 -Dsun.net.inetaddr.negative.ttl=0',
};
const result = spawnSync(gradlew, tasks, { cwd: agentDir, stdio: 'inherit', shell: isWindows, env });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('\nAPK: agents/android/agent/build/outputs/apk/release/agent-release.apk');

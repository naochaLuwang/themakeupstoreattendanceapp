import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeDir = join(root, 'android');
const command = process.argv[2] || 'sync';
if (!['sync', 'assets', 'open', 'run', 'build', 'bundle', 'release'].includes(command)) {
    throw new Error('Use sync, assets, open, run, build, bundle, or release.');
}

const environment = { ...process.env };
const javaCandidates = [
    environment.JAVA_HOME,
    '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
].filter(Boolean);
for (const candidate of javaCandidates) {
    const version = spawnSync(join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), ['-version'], { encoding: 'utf8' });
    const major = Number((version.stderr || version.stdout || '').match(/version "(\d+)/)?.[1]);
    // The pinned Gradle version supports JDK 21–24; JDK 25 needs a newer Gradle.
    if (version.status === 0 && major >= 21 && major <= 24) { environment.JAVA_HOME = candidate; break; }
}
const sdkCandidates = [environment.ANDROID_HOME, environment.ANDROID_SDK_ROOT,
    process.platform === 'darwin' ? join(homedir(), 'Library/Android/sdk') : join(homedir(), 'Android/Sdk')];
const sdk = sdkCandidates.find(candidate => candidate && existsSync(join(candidate, 'platform-tools')));
if (sdk) {
    environment.ANDROID_HOME = sdk;
    if (!existsSync(join(nativeDir, 'local.properties'))) {
        await writeFile(join(nativeDir, 'local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\').replaceAll(':', '\\:')}\n`);
    }
}

function run(executable, args, cwd = root) {
    const result = spawnSync(executable, args, { cwd, env: environment, stdio: 'inherit', shell: process.platform === 'win32' && executable.endsWith('.bat') });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
const capacitor = join(root, 'node_modules/@capacitor/cli/bin/capacitor');
if (['bundle', 'release'].includes(command)) {
    const firebase = JSON.parse(await readFile(join(nativeDir, 'app/google-services.json'), 'utf8'));
    const app = JSON.parse(await readFile(join(root, 'mobile/app.json'), 'utf8'));
    if (!firebase.client?.some(client => client.client_info?.android_client_info?.package_name === app.appId)) {
        throw new Error('The release needs Firebase Android configuration for this application ID.');
    }
}
run(process.execPath, [join(root, 'scripts/prepare-mobile.mjs')]);
if (['assets', 'build', 'bundle', 'release'].includes(command)) {
    const assetTool = join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets');
    run(process.execPath, [assetTool, 'generate', '--android', '--assetPath', 'mobile/assets',
        '--iconBackgroundColor', '#ffffff', '--iconBackgroundColorDark', '#ffffff',
        '--splashBackgroundColor', '#ffffff', '--splashBackgroundColorDark', '#ffffff', '--logoSplashScale', '0.2']);
}
run(process.execPath, [capacitor, 'sync', 'android']);
if (command === 'open' || command === 'run') run(process.execPath, [capacitor, command, 'android']);
if (['build', 'bundle', 'release'].includes(command)) {
    const gradle = join(nativeDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    const tasks = command === 'build' ? ['assembleDebug'] : command === 'bundle' ? ['bundleRelease'] : ['verifyReleaseSigning', 'testReleaseUnitTest', 'assembleRelease', 'bundleRelease'];
    run(gradle, [...tasks, '--no-daemon'], nativeDir);
    const outputDir = join(root, 'output/android');
    await mkdir(outputDir, { recursive: true });
    const artifacts = command === 'build'
        ? [['app/build/outputs/apk/debug/app-debug.apk', 'the-makeup-store-hrm-debug.apk']]
        : [['app/build/outputs/bundle/release/app-release.aab', 'the-makeup-store-hrm-release.aab'],
            ...(command === 'release' ? [['app/build/outputs/apk/release/app-release.apk', 'the-makeup-store-hrm-release.apk']] : [])];
    for (const [source, fileName] of artifacts) {
        await copyFile(join(nativeDir, source), join(outputDir, fileName));
        const digest = createHash('sha256').update(await readFile(join(outputDir, fileName))).digest('hex');
        await writeFile(join(outputDir, `${fileName}.sha256`), `${digest}  ${fileName}\n`);
        console.log(`Android package: ${join(outputDir, fileName)}`);
    }
}

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const command = process.argv[2] || 'sync';
if (!['sync', 'open', 'run'].includes(command)) throw new Error('Use sync, open, or run.');

const iosDir = join(root, 'ios');
const capacitor = join(root, 'node_modules/@capacitor/cli/bin/capacitor');
function run(args) {
    const result = spawnSync(process.execPath, [capacitor, ...args], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}

if (!existsSync(iosDir)) run(['add', 'ios']);
const assets = join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets');
const assetResult = spawnSync(process.execPath, [assets, 'generate', '--ios', '--assetPath', 'mobile/assets',
    '--iconBackgroundColor', '#ffffff', '--iconBackgroundColorDark', '#ffffff',
    '--splashBackgroundColor', '#ffffff', '--splashBackgroundColorDark', '#ffffff', '--logoSplashScale', '0.2'],
    { cwd: root, stdio: 'inherit' });
if (assetResult.error) throw assetResult.error;
if (assetResult.status !== 0) process.exit(assetResult.status || 1);
run(['sync', 'ios']);
if (command !== 'sync') run([command, 'ios']);

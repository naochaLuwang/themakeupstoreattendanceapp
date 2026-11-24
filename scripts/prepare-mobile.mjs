import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(await readFile(resolve(root, 'mobile/app.json'), 'utf8'));
const endpoint = new URL(process.env.CAPACITOR_SERVER_URL || app.serverUrl);
if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('The Android workspace must use an HTTPS origin without credentials, paths, queries, or fragments.');
}

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const webDir = resolve(root, 'mobile/www');
const assetDir = resolve(root, 'mobile/assets');
await mkdir(webDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
const logo = resolve(root, 'public/branding/the-makeup-store-hrm.png');
await copyFile(logo, resolve(webDir, 'logo.png'));
await copyFile(logo, resolve(assetDir, 'logo.png'));
const nativeAssets = resolve(root, 'android/app/src/main/assets');
await mkdir(nativeAssets, { recursive: true });
await copyFile(logo, resolve(nativeAssets, 'hrm-logo.png'));
await copyFile(resolve(root, 'public/fonts/barlow-condensed/BarlowCondensed-SemiBold.ttf'), resolve(nativeAssets, 'hrm-brand.ttf'));
await copyFile(resolve(root, 'public/fonts/barlow-condensed/OFL.txt'), resolve(nativeAssets, 'hrm-font-license.txt'));
for (const file of ['native-experience.js', 'native-experience.css']) {
    await copyFile(resolve(root, 'mobile', file), resolve(nativeAssets, file));
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(app.appName)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f8f8f7;color:#252923;font:16px/1.5 Arial,Helvetica,sans-serif}main{max-width:360px;text-align:center}img{display:block;margin:0 auto 24px;width:88px;height:88px;border-radius:16px}h1{font-size:20px;line-height:1.4;margin:0 0 12px}p{color:#555d52;margin:0 0 24px}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 24px;border-radius:8px;background:#704858;color:white;text-decoration:none}a:focus-visible{outline:2px solid #252923;outline-offset:4px}</style>
</head><body><main><img src="logo.png" alt=""><h1>${escapeHtml(app.appName)}</h1><p>We couldn’t connect to your workspace. Check your internet connection and try again. Attendance changes need a connection to save.</p><a href="${escapeHtml(endpoint.origin)}">Try again</a></main></body></html>
`;
await writeFile(resolve(webDir, 'index.html'), html);
await writeFile(resolve(webDir, 'offline.html'), html);
console.log('Prepared Android offline page and approved logo assets.');

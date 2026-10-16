// Static checks of the app against the My PC guide's rules that a script can see.
//   node tools/check-app.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './lib/common.mjs';
import { ownFiles } from './lib/app-files.mjs';

const errors = [];
const manifest = readJson(path.join(ROOT, 'mypc-app.json'));
const version = manifest.version;
for (const k of ['mypc', 'id', 'name', 'type', 'entry', 'icon', 'version']) if (manifest[k] === undefined) errors.push(`mypc-app.json: missing ${k}`);
if (manifest.name.length > 40) errors.push('mypc-app.json: name over 40 characters');
if ((manifest.description || '').length > 120) errors.push('mypc-app.json: description over 120 characters');
if (!fs.existsSync(path.join(ROOT, manifest.icon))) errors.push(`mypc-app.json: icon ${manifest.icon} does not exist`);
if (!fs.existsSync(path.join(ROOT, '.nojekyll'))) errors.push('.nojekyll is missing');
if (!fs.readFileSync(path.join(ROOT, 'src', 'version.js'), 'utf8').includes(`'${version}'`)) errors.push('src/version.js does not match the manifest version');

const BANNED = [
  [/addEventListener\(\s*['"]key(down|up|press)/, 'own keyboard listener (use MyPC onInput)'],
  [/getGamepads\s*\(/, 'navigator.getGamepads (use MyPC.gamepad)'],
  [/Object\.groupBy|Array\.fromAsync|\.union\(|\.intersection\(/, 'API newer than Chrome 108'],
  [/localStorage\.setItem\(\s*['"](?!dualingo_content_cache)/, 'localStorage save (use MyPC.save)'],
];
for (const file of ownFiles()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  // Every own file must be loaded with ?v=<version>.
  const refs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|src=|href=|url\()\s*['"]?(\.{0,2}\/?[\w./-]+\.(?:js|css|ttf|svg))(\?v=[\w.]+)?/g)];
  for (const m of refs) {
    if (/^https?:/.test(m[1]) || m[1].includes('mypc-sdk')) continue;
    if (m[2] !== `?v=${version}`) errors.push(`${rel}: ${m[1]} is not loaded with ?v=${version}`);
  }
  if (rel.endsWith('.js')) for (const [re, msg] of BANNED) if (re.test(text)) errors.push(`${rel}: ${msg}`);
  if (rel.endsWith('.css') && /\{[^}]*\{/.test(text.replace(/@(media|font-face|supports)[^{]*\{/g, ''))) errors.push(`${rel}: CSS nesting (not in Chrome 108)`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: app files load with ?v=${version}, manifest valid`);

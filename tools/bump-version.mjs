// Sets a new version everywhere My PC needs it: mypc-app.json, src/version.js and every ?v= on own files.
//   node tools/bump-version.mjs 2.1.0
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './lib/common.mjs';
import { ownFiles } from './lib/app-files.mjs';

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || '')) { console.error('Usage: node tools/bump-version.mjs <major.minor.patch>'); process.exit(1); }
const manifestPath = path.join(ROOT, 'mypc-app.json');
const manifest = readJson(manifestPath);
const prev = manifest.version;
manifest.version = next;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
let changed = 0;
for (const file of ownFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  let out = text.split(`?v=${prev}`).join(`?v=${next}`);
  if (file.endsWith(path.join('src', 'version.js'))) out = out.replace(`'${prev}'`, `'${next}'`);
  if (out !== text) { fs.writeFileSync(file, out); changed++; }
}
console.log(`Version ${prev} -> ${next} in mypc-app.json and ${changed} files`);

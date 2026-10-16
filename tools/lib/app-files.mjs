import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './common.mjs';

// The files the TV loads: index.html, src/**/*.js, styles/*.css.
export function ownFiles() {
  const out = [path.join(ROOT, 'index.html')];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css)$/.test(name)) out.push(full);
    }
  })(path.join(ROOT, 'src'));
  for (const name of fs.readdirSync(path.join(ROOT, 'styles'))) out.push(path.join(ROOT, 'styles', name));
  return out;
}

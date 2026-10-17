// Reads and writes content/src unit files in their hand-edited layout (one word or sentence per line).
import fs from 'node:fs';

export const readUnit = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function writeUnit(file, u) {
  const lines = [];
  const head = ['id', 'level', 'order'].filter((k) => k in u).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(u[k])}`).join(', ');
  lines.push(`  ${head}`);
  for (const [k, v] of Object.entries(u)) {
    if (['id', 'level', 'order'].includes(k)) continue;
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') lines.push(`  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`);
    else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  fs.writeFileSync(file, `{\n${lines.join(',\n')}\n}\n`);
}

// Does a sentence contain a word? Accent-blind. Words of 3+ letters match as substrings (inflections); infinitives
// ("to live", "habiter") also match by stem; very short words match whole tokens only.
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function mentions(sentence, word) {
  const a = norm(sentence);
  let b = norm(word).replace(/[.,!?¿¡،؟]/g, '').trim().replace(/^to /, '');
  if (!b) return false;
  if (b.length <= 2) return a.split(/[\s.,!?¿¡،؟]+/).includes(b);
  if (a.includes(b)) return true;
  return b.length >= 6 && !/\s/.test(b) && a.includes(b.slice(0, -2));
}

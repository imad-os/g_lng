// Adds "uses": [word ids] to every sentence that has none: the unit words the sentence teaches, found by text match in
// the languages that have both. A word counts when it is found in at least two languages (or in the only one there is).
// Usage: node tools/tag-uses.mjs [--report]   (--report only lists words that no sentence uses)
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from './lib/common.mjs';
import { readUnit, writeUnit, mentions } from './lib/unit-io.mjs';

const LANGS = ['en', 'fr', 'es', 'ar', 'de'];
const report = process.argv.includes('--report');
const retag = process.argv.includes('--retag');   // recompute every sentence (this drops hand-written "uses")
const gaps = {};
for (const lv of fs.readdirSync(SRC)) {
  const dir = path.join(SRC, lv);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f);
    const u = readUnit(file);
    if (u.only || !u.sentences) continue;
    for (const s of u.sentences) {
      if (s.uses && !retag) continue;
      s.uses = u.words.filter((w) => {
        const both = LANGS.filter((L) => w.text[L] && s.text[L]);
        const found = both.filter((L) => mentions(s.text[L], w.text[L])).length;
        return found >= Math.min(2, both.length) && found > 0;
      }).map((w) => w.id);
    }
    const used = new Set(u.sentences.flatMap((s) => s.uses));
    const miss = u.words.filter((w) => !used.has(w.id)).map((w) => w.id);
    if (miss.length) gaps[`${lv}/${f.replace('.json', '')}`] = miss;
    if (!report) writeUnit(file, u);
  }
}
const n = Object.values(gaps).reduce((a, g) => a + g.length, 0);
console.log(`${n} words in ${Object.keys(gaps).length} units are used by no sentence`);
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(gaps, null, 1));

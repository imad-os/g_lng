// Checks source unit files without building: node tools/check-source.mjs content/src/b2/u01.json [...]
import { readFileSync } from 'node:fs';

const UI = ['en', 'fr', 'es', 'ar'];
let bad = 0;
const fail = (f, m) => { bad++; console.error(`${f}: ${m}`); };

for (const file of process.argv.slice(2)) {
  let u;
  try { u = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(file, `bad JSON: ${e.message}`); continue; }
  for (const k of ['id', 'level', 'order']) if (u[k] == null) fail(file, `missing ${k}`);
  for (const k of ['title', 'tip']) for (const l of UI) if (!u[k]?.[l]) fail(file, `${k}.${l} missing`);
  const ids = new Set();
  const texts = {};
  const items = [...(u.words || []).map((w) => ['word', w]), ...(u.sentences || []).map((s) => ['sentence', s])];
  for (const [kind, it] of items) {
    if (!it.id || ids.has(it.id)) fail(file, `${kind} id "${it.id}" missing or duplicated`);
    ids.add(it.id);
    for (const l of UI) if (!it.text?.[l]) fail(file, `${it.id} has no ${l} text`);
    for (const [l, t] of Object.entries(it.text || {})) {
      if (typeof t !== 'string' || !t.trim()) fail(file, `${it.id}.${l} empty`);
      const key = `${kind}:${l}:${String(t).toLowerCase()}`;
      if ((l === 'es' || l === 'de' || kind === 'word') && texts[key]) fail(file, `${it.id} and ${texts[key]} share ${l} text "${t}"`);
      texts[key] = it.id;
    }
  }
  if ((u.words || []).length < 12) fail(file, `only ${(u.words || []).length} words`);
  if ((u.sentences || []).length < 10) fail(file, `only ${(u.sentences || []).length} sentences`);
  const sids = new Set((u.sentences || []).map((s) => s.id));
  const d = u.dialogue || [];
  if (d.length < 3 || d.length > 6) fail(file, `dialogue has ${d.length} lines (need 3 to 6)`);
  for (const id of d) if (!sids.has(id)) fail(file, `dialogue line ${id} is not a sentence id`);
  console.log(`${file}: ${(u.words || []).length} words, ${(u.sentences || []).length} sentences`);
}
process.exit(bad ? 1 : 0);

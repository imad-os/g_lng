// Checks every built document before it is seeded into Firestore.
//   node tools/validate.mjs        (exit code 1 when anything is wrong)
import { readBuild, tokenize, UI_LANGS } from './lib/common.mjs';

const TYPES = new Set(['pick_translation', 'pick_target', 'listen_pick', 'word_bank', 'fill_gap', 'match_pairs', 'true_false', 'order_dialogue']);
const MAX_DOC_BYTES = 900 * 1024;   // Firestore allows 1 MiB per document
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const docs = readBuild();
const byPath = Object.fromEntries(docs.map((d) => [d.path, d.data]));
if (!byPath['meta/catalog']) fail('meta/catalog', 'missing');

for (const { path, data } of docs) {
  const size = Buffer.byteLength(JSON.stringify(data));
  if (size > MAX_DOC_BYTES) fail(path, `${size} bytes is too big for one Firestore document`);
  noNestedArrays(path, data, 'root');
  if (/\/lessons\//.test(path)) checkLesson(path, data);
  if (/\/levels\//.test(path)) for (const u of data.units) for (const l of u.lessons) if (!byPath[path.replace(/levels\/.*/, `lessons/${l.id}`)]) fail(path, `lesson ${l.id} has no document`);
}

const lessons = docs.filter((d) => /\/lessons\//.test(d.path)).length;
const exercises = docs.filter((d) => /\/lessons\//.test(d.path)).reduce((n, d) => n + d.data.ex.length, 0);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) in ${docs.length} documents`);
  process.exit(1);
}
console.log(`OK: ${docs.length} documents, ${lessons} lessons, ${exercises} exercises`);

function noNestedArrays(where, value, at) {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (Array.isArray(v)) fail(where, `nested array at ${at} (Firestore cannot store arrays inside arrays)`);
      noNestedArrays(where, v, at + '[]');
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) noNestedArrays(where, v, `${at}.${k}`);
  }
}

function checkLesson(path, lesson) {
  if (lesson.ex.length < 5) fail(path, `only ${lesson.ex.length} exercises`);
  const ids = new Set();
  const seen = new Set();
  for (const [key, v] of Object.entries(lesson.vocab)) {
    if (!v.t) fail(path, `${key} has no text`);
    for (const g of UI_LANGS) if (!v.g[g]) fail(path, `${key} has no ${g} translation`);
  }
  for (const e of lesson.ex) {
    const at = `${path} ${e.id}`;
    if (ids.has(e.id)) fail(at, 'duplicate exercise id');
    ids.add(e.id);
    if (!TYPES.has(e.type)) fail(at, `unknown type ${e.type}`);
    const sig = JSON.stringify({ ...e, id: 0 });
    if (seen.has(sig)) fail(at, 'repeats an earlier exercise');
    seen.add(sig);
    for (const k of [e.item, e.shown, ...(e.items || [])].filter(Boolean)) if (!lesson.vocab[k]) fail(at, `${k} is not in the lesson vocab`);
    switch (e.type) {
      case 'pick_translation': case 'pick_target': case 'listen_pick':
        if (!e.opts.includes(e.item)) fail(at, 'answer is not among the options');
        if (new Set(e.opts).size !== e.opts.length) fail(at, 'options repeat');
        if (e.opts.length < 2) fail(at, 'fewer than 2 options');
        for (const k of e.opts) if (!lesson.vocab[k]) fail(at, `option ${k} is not in the lesson vocab`);
        break;
      case 'word_bank': {
        const answer = tokenize(lesson.vocab[e.item].t);
        if (!answer.length) fail(at, 'empty answer');
        for (const x of e.extra) if (answer.some((a) => a.toLowerCase() === x.toLowerCase())) fail(at, `extra tile "${x}" is also in the answer`);
        break;
      }
      case 'fill_gap': {
        const toks = tokenize(lesson.vocab[e.item].t);
        if (!(e.gap >= 0 && e.gap < toks.length)) fail(at, 'gap is outside the sentence');
        else if (!e.opts.includes(toks[e.gap])) fail(at, 'gap word is not among the options');
        if (new Set(e.opts.map((o) => o.toLowerCase())).size !== e.opts.length) fail(at, 'options repeat');
        break;
      }
      case 'match_pairs':
        if (e.items.length < 3) fail(at, 'fewer than 3 pairs');
        if (new Set(e.items.map((k) => lesson.vocab[k].t)).size !== e.items.length) fail(at, 'two pairs share the same text');
        break;
      case 'true_false':
        if ((e.item === e.shown) !== e.answer) fail(at, 'answer does not match the shown translation');
        break;
      case 'order_dialogue':
        if (e.items.length < 3) fail(at, 'fewer than 3 lines');
        break;
    }
  }
}

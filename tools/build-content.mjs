// Builds the Firestore documents from content/src into content/build.
// Each file in content/build is one Firestore document at the same path (courses/fr/lessons/b1-u01-l1.json).
//   node tools/build-content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { SRC, BUILD, UI_LANGS, readJson, writeJson, tokenize, rng, shuffle, hash } from './lib/common.mjs';

const meta = readJson(path.join(SRC, 'courses.json'));
const levelById = Object.fromEntries(meta.levels.map((l) => [l.id, l]));
// A unit only appears in a course when it has enough words in that language to make real lessons.
const MIN_WORDS = 6;
const hasUnit = (u, L) => u.words.filter((w) => w.text[L]).length >= MIN_WORDS;

// Units grouped by level: content/src/<level>/<unit>.json
const unitsByLevel = {};
for (const level of meta.levels) {
  const dir = path.join(SRC, level.id);
  if (!fs.existsSync(dir)) continue;
  unitsByLevel[level.id] = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => readJson(path.join(dir, f))).sort((a, b) => a.order - b.order);
}

const LESSON_TITLES = {
  story: { en: 'Conversation', fr: 'Conversation', es: 'Conversación', ar: 'محادثة' },
  review: { en: 'Unit review', fr: 'Révision de l\'unité', es: 'Repaso de la unidad', ar: 'مراجعة الوحدة' },
};

fs.rmSync(BUILD, { recursive: true, force: true });
const docs = [];
const put = (docPath, data) => docs.push({ path: docPath, data });

for (const course of meta.courses) {
  const L = course.id;
  const courseLevels = [];
  for (const levelId of course.levels) {
    const level = levelById[levelId];
    const units = (unitsByLevel[levelId] || []).filter((u) => hasUnit(u, L));
    const unitSummaries = [];
    for (const unit of units) {
      const built = buildUnit(L, level, unit);
      unitSummaries.push({ id: built.unit.id, order: unit.order, title: unit.title, lessons: built.unit.lessons });
      put(`courses/${L}/units/${built.unit.id}`, built.unit);
      put(`courses/${L}/lexicon/${built.unit.id}`, built.lexicon);
      for (const lesson of built.lessons) put(`courses/${L}/lessons/${lesson.id}`, lesson);
    }
    put(`courses/${L}/levels/${levelId}`, { id: levelId, code: level.code, stage: level.stage, title: level.title, goal: level.goal, units: unitSummaries });
    courseLevels.push({ id: levelId, code: level.code, stage: level.stage, title: level.title, units: unitSummaries.length });
  }
  put(`courses/${L}`, { id: L, name: course.name, native: course.native, rtl: course.rtl, script: course.script, tts: course.tts, levels: courseLevels });
}

const version = hash(JSON.stringify(docs));
put('meta/catalog', {
  version,
  courses: meta.courses.map((c) => ({
    id: c.id, name: c.name, native: c.native, rtl: c.rtl,
    levels: c.levels,
    ready: c.levels.filter((id) => (unitsByLevel[id] || []).some((u) => hasUnit(u, c.id))),
  })),
});
for (const d of docs) writeJson(path.join(BUILD, d.path + '.json'), d.data);
console.log(`Built ${docs.length} documents, content version ${version}`);

// ---------------------------------------------------------------------------

function buildUnit(L, level, unit) {
  const unitId = `${level.id}-${unit.id}`;
  const rand = rng(`${L}/${unitId}`);
  const vocab = {};
  const entry = (kind, src) => {
    const key = `${kind}.${src.id}`;
    if (!vocab[key]) {
      const v = { k: kind, t: src.text[L], g: {}, a: `${L}/${unitId}/${kind}-${src.id}` };
      if (src.tr && src.tr[L]) v.tr = src.tr[L];
      for (const g of UI_LANGS) if (src.text[g]) v.g[g] = src.text[g];
      vocab[key] = v;
    }
    return key;
  };
  const words = unit.words.filter((w) => w.text[L]).map((w) => entry('w', w));
  const sentences = unit.sentences.filter((s) => s.text[L]).map((s) => entry('s', s));
  const dialogue = (unit.dialogue || []).filter((id) => vocab[`s.${id}`]).map((id) => `s.${id}`);

  // 4 learn lessons for a small unit; big units get more lessons of at most 6 new words each.
  const learnLessons = Math.max(4, Math.ceil(words.length / 6));
  const wordGroups = chunk(words, learnLessons);
  const sentenceGroups = chunk(sentences, learnLessons);
  const lessons = [];
  const makeLesson = (type, order, title, newWords, build) => {
    const id = `${unitId}-l${order}`;
    const ex = [];
    const add = (e) => { if (e) ex.push({ id: `${id}-e${String(ex.length + 1).padStart(2, '0')}`, ...e }); };
    build(add);
    const used = new Set();
    for (const e of ex) for (const k of refs(e)) used.add(k);
    const lessonVocab = {};
    for (const k of used) lessonVocab[k] = vocab[k];
    lessons.push({ id, unit: unitId, level: level.id, order, type, title, newWords, vocab: lessonVocab, ex });
  };

  // Learn lessons: new words, then sentences that use them.
  wordGroups.forEach((group, i) => {
    const known = wordGroups.slice(0, i).flat();
    const title = {};
    for (const g of UI_LANGS) title[g] = group.map((k) => vocab[k].g[g]).filter(Boolean).join(g === 'ar' ? '، ' : ', ');
    makeLesson('learn', i + 1, title, group, (add) => {
      for (const k of group) add(pick('pick_translation', k, words));
      for (const k of group.length > 4 ? shuffle(group, rand).slice(0, 3) : group) add(pick('listen_pick', k, words));
      if (group.length + known.length >= 3) add({ type: 'match_pairs', items: shuffle([...group, ...shuffle(known, rand)].slice(0, 5), rand) });
      for (const k of group.length > 4 ? shuffle(group, rand).slice(0, 3) : group) add(pick('pick_target', k, words));
      for (const s of (sentenceGroups[i] || []).slice(0, 3)) add(wordBank(s));
      const s0 = (sentenceGroups[i] || [])[0];
      if (s0) add(fillGap(s0));
      add(trueFalse(group[Math.floor(rand() * group.length)], words));
    });
  });

  // Lesson 5: the unit's conversation.
  if (sentences.length >= 3) {
    makeLesson('story', wordGroups.length + 1, LESSON_TITLES.story, [], (add) => {
      if (dialogue.length >= 3) add({ type: 'order_dialogue', items: dialogue });
      for (const s of shuffle(sentences, rand).slice(0, 3)) add(trueFalse(s, sentences));
      for (const s of shuffle(sentences, rand).slice(0, 2)) add(pick('listen_pick', s, sentences));
      for (const s of shuffle(sentences, rand).slice(0, 3)) add(wordBank(s));
      for (const s of shuffle(sentences, rand).slice(0, 2)) add(pick('pick_translation', s, sentences));
    });
  }

  // Last lesson: unit review.
  makeLesson('review', lessons.length + 1, LESSON_TITLES.review, [], (add) => {
    for (const k of shuffle(words, rand).slice(0, 4)) add(pick('pick_target', k, words));
    for (const k of shuffle(words, rand).slice(0, 3)) add(pick('listen_pick', k, words));
    add({ type: 'match_pairs', items: shuffle(words, rand).slice(0, 5) });
    for (const s of shuffle(sentences, rand).slice(0, 3)) add(wordBank(s));
    for (const s of shuffle(sentences, rand).slice(0, 2)) add(fillGap(s));
  });

  const lexicon = { unit: unitId, words: Object.fromEntries(words.map((k) => [k, vocab[k]])) };
  const unitDoc = {
    id: unitId, level: level.id, order: unit.order, title: unit.title, tip: unit.tip, words: words.length,
    lessons: lessons.map((l) => ({ id: l.id, type: l.type, order: l.order, title: l.title, count: l.ex.length })),
  };
  return { unit: unitDoc, lexicon, lessons };

  // --- exercise builders --------------------------------------------------
  function pick(type, key, pool) {
    const others = shuffle(pool.filter((k) => k !== key && vocab[k].t !== vocab[key].t), rand).slice(0, 3);
    if (!others.length) return null;
    return { type, item: key, opts: shuffle([key, ...others], rand) };
  }
  function trueFalse(key, pool) {
    const truth = rand() < 0.5;
    const other = shuffle(pool.filter((k) => k !== key), rand)[0];
    if (!other) return null;
    return { type: 'true_false', item: key, shown: truth ? key : other, answer: truth };
  }
  function wordBank(key) {
    const answer = tokenize(vocab[key].t);
    const pool = new Map();
    for (const k of shuffle([...sentences, ...words], rand)) for (const tok of tokenize(vocab[k].t)) if (!answer.some((a) => a.toLowerCase() === tok.toLowerCase())) pool.set(tok.toLowerCase(), tok);
    return { type: 'word_bank', item: key, extra: [...pool.values()].slice(0, Math.min(3, Math.max(2, 6 - answer.length))) };
  }
  function fillGap(key) {
    const toks = tokenize(vocab[key].t);
    if (toks.length < 2) return null;
    let gap = 0;
    toks.forEach((t, i) => { if (t.length > toks[gap].length) gap = i; });
    const pool = new Map();
    for (const k of shuffle([...words, ...sentences], rand)) for (const tok of tokenize(vocab[k].t)) if (tok.toLowerCase() !== toks[gap].toLowerCase()) pool.set(tok.toLowerCase(), tok);
    return { type: 'fill_gap', item: key, gap, opts: shuffle([toks[gap], ...[...pool.values()].slice(0, 3)], rand) };
  }
}

function refs(e) {
  const out = [];
  if (e.item) out.push(e.item);
  if (e.shown) out.push(e.shown);
  if (e.items) out.push(...e.items);
  if (e.opts && e.type !== 'fill_gap') out.push(...e.opts);
  return out;
}

function chunk(list, n) {
  const size = Math.ceil(list.length / n) || 1;
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

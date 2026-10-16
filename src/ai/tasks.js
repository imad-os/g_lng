// What the model is asked to do: explain an exercise or a unit, or invent a small custom lesson.
// The model is never trusted: its JSON is parsed and checked strictly before a lesson is built from it.
import { chat } from './client.js?v=2.3.0';
import { t, pickLang } from '../platform/i18n.js?v=2.3.0';
import { tokenize } from '../learning/text.js?v=2.3.0';

const UI_NAMES = { en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic' };
const MAX_LEN = 90;
const LESSON_SIZE = 10;

const courseName = (course) => `${(course.name && (course.name.en || pickLang(course.name))) || course.id} (code "${course.id}")`;
const gloss = (v, from) => (v && v.g && (v.g[from] || v.g.en)) || '';
const needsTr = (course) => course.script === 'Arabic' || course.script === 'Tifinagh';

function styleRules(course, from) {
  return `Write the whole answer in ${UI_NAMES[from] || 'English'}. Plain text only, no markdown, no lists of more than 5 lines. `
    + `Keep target-language words in their own script. `
    + (needsTr(course) ? 'Give the Latin transliteration of target-language words you quote. ' : '')
    + 'Cover grammar, morphology and script notes that help a beginner.';
}

export async function explainExercise({ course, ex, vocab, from }) {
  const keys = ex.items || [ex.item, ex.shown].filter(Boolean);
  const lines = keys.map((k) => vocab[k]).filter(Boolean)
    .map((v) => `- ${v.t}${v.tr ? ` [${v.tr}]` : ''} = ${gloss(v, from)}`).join('\n');
  return chat({
    system: `You are a patient teacher of ${courseName(course)}. Explain in at most 120 words. ${styleRules(course, from)}`,
    user: `Exercise type: ${ex.type}.\nWords involved:\n${lines}\nExplain why the answer is what it is and what to notice in the target language.`,
  });
}

export async function explainUnit({ course, unit, words, from }) {
  const title = unit && unit.title ? (typeof unit.title === 'string' ? unit.title : pickLang(unit.title, from)) : '';
  const lines = (words || []).slice(0, 30).map((w) => (typeof w === 'string' ? `- ${w}` : `- ${w.t}${w.tr ? ` [${w.tr}]` : ''} = ${gloss(w, from)}`)).join('\n');
  return chat({
    system: `You are a patient teacher of ${courseName(course)}. Give a short grammar breakdown of a unit in at most 160 words. ${styleRules(course, from)}`,
    user: `Unit: ${title}\nWords:\n${lines}\nExplain the main grammar points these words show.`,
  });
}

// ---- Custom lesson -------------------------------------------------------------------------

const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
const okText = (s) => typeof s === 'string' && clean(s).length > 0 && clean(s).length <= MAX_LEN;

// Pull the JSON out of a model reply (it may add code fences or chatter around it).
export function parseModelJson(raw) {
  const s = String(raw || '');
  const a = s.search(/[\[{]/);
  const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (a < 0 || b <= a) throw new Error(t('ai.errBadLesson'));
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error(t('ai.errBadLesson')); }
}

// Keep only well-formed, unambiguous words: { t, g:{from,en}, tr? }. Throws when too few are left.
export function validateWords(data, { from, course, count }) {
  const list = Array.isArray(data) ? data : data && data.words;
  if (!Array.isArray(list)) throw new Error(t('ai.errBadLesson'));
  const seenT = new Set(), seenG = new Set(), out = [];
  for (const w of list) {
    if (!w || !okText(w.t) || !okText(w.en) || (from !== 'en' && !okText(w[from]))) continue;
    const tt = clean(w.t), g = { en: clean(w.en) };
    if (from !== 'en') g[from] = clean(w[from]);
    const gk = (g[from] || g.en).toLowerCase();
    if (seenT.has(tt.toLowerCase()) || seenG.has(gk)) continue;   // two words with one meaning make options unfair
    seenT.add(tt.toLowerCase()); seenG.add(gk);
    const item = { t: tt, g };
    if (needsTr(course) && okText(w.tr)) item.tr = clean(w.tr);
    out.push(item);
    if (out.length >= Math.min(count, 12)) break;
  }
  if (out.length < 4) throw new Error(t('ai.errBadLesson'));
  return out;
}

const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length]);

// Words -> a lesson object like the ones in content/, with 10 exercises of the existing shapes.
export function buildLesson(words, { from, theme }) {
  const keys = words.map((_, i) => `w.${i + 1}`);
  const vocab = {};
  words.forEach((w, i) => { vocab[keys[i]] = { k: 'w', t: w.t, g: w.g, ...(w.tr ? { tr: w.tr } : {}), a: '' }; });
  const multi = keys.filter((k) => tokenize(vocab[k].t).length >= 2);
  const ex = [];
  const add = (e) => ex.push({ id: `ai-e${String(ex.length + 1).padStart(2, '0')}`, ...e });
  const opts = (k, i) => {
    const others = rotate(keys, i + 1).filter((x) => x !== k).slice(0, Math.min(3, keys.length - 1));
    return rotate([k, ...others], i % 3);
  };
  const plan = ['pick_translation', 'pick_target', 'match_pairs', 'true_false', 'pick_translation', 'pick_target', 'word_bank', 'match_pairs', 'true_false', 'pick_target'];
  plan.slice(0, LESSON_SIZE).forEach((type, n) => {
    const k = keys[n % keys.length];
    if (type === 'match_pairs') {
      add({ type, items: rotate(keys, n).slice(0, Math.min(5, keys.length)) });
    } else if (type === 'true_false') {
      const truth = n % 4 === 3;
      add({ type, item: k, shown: truth ? k : keys[(n + 1) % keys.length], answer: truth });
    } else if (type === 'word_bank' && multi.length) {
      const key = multi[0];
      const answer = tokenize(vocab[key].t).map((x) => x.toLowerCase());
      const pool = [...new Set(keys.flatMap((x) => tokenize(vocab[x].t)))].filter((x) => !answer.includes(x.toLowerCase()));
      add({ type, item: key, extra: pool.slice(0, 2) });
    } else {
      add({ type: type === 'word_bank' ? 'pick_target' : type, item: k, opts: opts(k, n) });
    }
  });
  const label = clean(theme).slice(0, 40);
  return {
    id: `ai-${Date.now()}`, ai: true, review: true, type: 'learn',
    title: { en: label, fr: label, es: label, ar: label },
    newWords: keys.slice(), vocab, ex,
  };
}

export async function customLesson({ course, from, theme, count = LESSON_SIZE, signal }) {
  const wanted = Math.max(6, Math.min(12, count | 0 || LESSON_SIZE));
  const subject = clean(theme || '').slice(0, 60);
  if (!subject) throw new Error(t('ai.errNoTheme'));
  const fromName = UI_NAMES[from] || 'English';
  const reply = await chat({
    json: true, signal,
    system: 'You write vocabulary lists for a language-learning app. Answer ONLY with a JSON object, no markdown, no comments.',
    user: `Target language: ${courseName(course)}. Learner's language: ${fromName} (code "${from}").\n`
      + `Theme: "${subject}".\nGive ${wanted} useful beginner words or short phrases (at most 4 words each) about the theme.\n`
      + `JSON shape: {"words":[{"t":"<target language text>","${from}":"<translation in ${fromName}>","en":"<English translation>"${needsTr(course) ? ',"tr":"<Latin transliteration>"' : ''}}]}\n`
      + 'Every word different, correct and natural. Nothing outside the JSON.',
  });
  const words = validateWords(parseModelJson(reply), { from, course, count: wanted });
  return buildLesson(words, { from, theme: subject });
}

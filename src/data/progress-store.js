// Learner progress, saved only through MyPC.save / MyPC.load (per My PC profile, 64 KB per app).
// Keys:  me        settings, XP, streak, active course
//        c:<lang>  level, placed level index, finished lessons (id -> stars), course XP
//        w:<lang>  spaced repetition per word: "unit|word" -> [box, dueDay, right, wrong, lastDay]
//        k:<lang>  accuracy per exercise type: type -> [attempts, correct]
//        x:<lang>  last mistakes: [exerciseId, day, picked]
import { today } from '../learning/day.js?v=2.5.7';

const LIMIT = 60 * 1024;         // stay under My PC's 64 KB
const MAX_WORDS = 700;           // per course; the oldest mastered words go first when space runs out
const MAX_MISTAKES = 40;

let sdk = null;
let me = null;
const courses = new Map();

export function openProgress(MyPC, uiLang) {
  sdk = MyPC;
  me = Object.assign({
    v: 2, course: null, from: uiLang, ui: '', goal: 20, speech: true, sfx: true,
    xp: 0, gems: 50, streak: 0, streakDay: -1, day: -1, dayXp: 0, started: [],
    week: -1, weekXp: 0, q: { day: -1, combo: 0, lessons: 0, paid: [] },
  }, sdk.load('me', {}) || {});
  rollDay();
  return me;
}

export function getMe() { return me; }

// Small extra saves outside the course data (for example the optional AI settings).
export function loadExtra(key, fallback) { return sdk.load(key, fallback); }
export function saveExtra(key, value) { sdk.save(key, value); }

export function saveMe() { sdk.save('me', me); }

function rollDay() {
  const d = today();
  if (me.day !== d) { me.day = d; me.dayXp = 0; }
  const wk = Math.floor((d + 3) / 7);
  if (me.week !== wk) { me.week = wk; me.weekXp = 0; }
  if (me.streakDay >= 0 && d - me.streakDay > 1) me.streak = 0;
}

export function course(lang) {
  if (!courses.has(lang)) {
    courses.set(lang, {
      c: Object.assign({ level: 'b1', placed: 0, done: {}, xp: 0 }, sdk.load('c:' + lang, {}) || {}),
      w: sdk.load('w:' + lang, {}) || {},
      k: sdk.load('k:' + lang, {}) || {},
      x: sdk.load('x:' + lang, []) || [],
    });
  }
  return courses.get(lang);
}

export function saveCourse(lang) {
  const p = course(lang);
  if (!me.started.includes(lang)) me.started.push(lang);
  if (p.x.length > MAX_MISTAKES) p.x.splice(0, p.x.length - MAX_MISTAKES);
  trimWords(p.w, MAX_WORDS);
  // Several courses share the 64 KB: shrink whichever course holds the most words.
  while (sizeOfAll() > LIMIT) {
    const biggest = me.started.map((l) => course(l).w).sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0];
    const n = Object.keys(biggest).length;
    if (n <= 50) break;
    trimWords(biggest, Math.floor(n * 0.85));
  }
  for (const l of me.started) if (l !== lang) { const q = course(l); sdk.save('w:' + l, q.w); }
  sdk.save('c:' + lang, p.c);
  sdk.save('w:' + lang, p.w);
  sdk.save('k:' + lang, p.k);
  sdk.save('x:' + lang, p.x);
  saveMe();
}

export function hasCourse(lang) { return me.started.includes(lang); }

export function resetCourse(lang) {
  courses.set(lang, { c: { level: 'b1', placed: 0, done: {}, xp: 0 }, w: {}, k: {}, x: [] });
  saveCourse(lang);
}

// Keep the words that matter most: due soon, weak, recently seen.
function trimWords(w, max) {
  const keys = Object.keys(w);
  if (keys.length <= max) return;
  const d = today();
  keys.sort((a, b) => keep(w[b], d) - keep(w[a], d));
  for (const k of keys.slice(max)) delete w[k];
}
const keep = (e, d) => (5 - e[0]) * 10 - Math.max(0, e[1] - d) - (d - e[4]) * 0.5;

function sizeOfAll() {
  let n = JSON.stringify(me).length;
  for (const lang of me.started || []) {
    const p = course(lang);
    n += JSON.stringify(p.c).length + JSON.stringify(p.w).length + JSON.stringify(p.k).length + JSON.stringify(p.x).length;
  }
  return n;
}

export function progressBytes() { return sizeOfAll(); }

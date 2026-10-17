// Placement quiz: 12 questions that climb through the course's levels, to suggest where to start.
import { getLevel, getLexicon } from '../data/content-repo.js?v=2.6.0';

export const QUIZ_LENGTH = 12;

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Each question: { level: index in course.levels, item, opts, vocab }. Easy first, hard last.
export async function buildQuiz(lang, course) {
  const levels = course.levels.filter((l) => l.units > 0);
  const docs = await Promise.all(levels.map((l) => getLevel(lang, l.id).catch(() => null)));
  const lex = {};
  const questions = [];
  const used = new Set();
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const li = Math.min(levels.length - 1, Math.floor((i * levels.length) / QUIZ_LENGTH));
    const doc = docs[li];
    if (!doc || !doc.units.length) continue;
    const unit = doc.units[(i * 3 + 1) % doc.units.length];
    if (!lex[unit.id]) { try { lex[unit.id] = await getLexicon(lang, unit.id); } catch (e) { lex[unit.id] = null; } }
    const words = lex[unit.id] ? Object.entries(lex[unit.id].words) : [];
    if (words.length < 4) continue;
    const pool = shuffle(words);
    const target = pool.find(([k]) => !used.has(unit.id + k));
    if (!target) continue;
    used.add(unit.id + target[0]);
    const others = pool.filter(([k, v]) => k !== target[0] && v.t !== target[1].t).slice(0, 3);
    const vocab = Object.fromEntries([target, ...others]);
    questions.push({ level: course.levels.findIndex((l) => l.id === levels[li].id), item: target[0], opts: shuffle(Object.keys(vocab)), vocab });
  }
  return questions;
}

// answers: 'right' | 'wrong' | 'unsure' per question, in order. Two misses within three answers end the climb;
// the learner starts at the level of the first of those misses.
export function estimateLevel(questions, answers) {
  const miss = (a) => a !== 'right';
  for (let i = 0; i < answers.length; i++) {
    if (!miss(answers[i])) continue;
    const window = answers.slice(i, i + 3);
    if (window.filter(miss).length >= 2 || i === answers.length - 1) return Math.max(0, questions[i].level);
  }
  return questions.length ? questions[questions.length - 1].level : 0;
}

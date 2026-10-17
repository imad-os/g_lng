// Builds a review session from words that are due (then weak, then recent), as a lesson-shaped object.
import { course } from '../data/progress-store.js?v=2.7.1';
import { getLexicon } from '../data/content-repo.js?v=2.7.1';
import { dueKeys, weakKeys } from './srs.js?v=2.7.1';

const SIZE = 10;

export async function buildReview(lang) {
  const w = course(lang).w;
  let keys = dueKeys(w, SIZE);
  if (keys.length < SIZE) for (const k of weakKeys(w, SIZE)) if (keys.length < SIZE && !keys.includes(k)) keys.push(k);
  if (keys.length < SIZE) for (const k of Object.keys(w).sort((a, b) => w[b][4] - w[a][4])) if (keys.length < SIZE && !keys.includes(k)) keys.push(k);
  if (!keys.length) return null;

  // Load the units these words come from; their other words serve as wrong options.
  const units = [...new Set(Object.keys(w).map((k) => k.split('|')[0]))];
  const vocab = {};
  for (const unit of units) {
    let lex = null;
    try { lex = await getLexicon(lang, unit); } catch (e) { lex = null; }
    if (lex) for (const [k, v] of Object.entries(lex.words)) vocab[`${unit}|${k}`] = v;
  }
  keys = keys.filter((k) => vocab[k]);
  const pool = Object.keys(vocab);
  if (!keys.length || pool.length < 2) return null;

  const types = ['pick_target', 'listen_pick', 'pick_translation'];
  const ex = keys.map((k, i) => {
    const others = shuffle(pool.filter((o) => o !== k && vocab[o].t !== vocab[k].t)).slice(0, 3);
    return { id: `review-e${i + 1}`, type: types[i % types.length], item: k, opts: shuffle([k, ...others]) };
  });
  if (keys.length >= 4) ex.splice(Math.floor(ex.length / 2), 0, { id: 'review-match', type: 'match_pairs', items: shuffle(keys).slice(0, 5) });
  return { id: 'review', review: true, type: 'review', vocab, ex, newWords: [] };
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Spaced repetition (Leitner boxes 0-5). A right answer moves a word up a box and pushes its next
// review further away; a wrong one drops it back to box 0, due today.
import { today } from './day.js?v=2.0.0';

const INTERVAL = [0, 1, 2, 4, 8, 16];   // days until the next review, by box

export const srsKey = (unitId, wordKey) => `${unitId}|${wordKey}`;

export function record(w, key, correct) {
  const d = today();
  const e = w[key] || [0, d, 0, 0, d];
  if (correct) { e[0] = Math.min(5, e[0] + 1); e[2]++; } else { e[0] = 0; e[3]++; }
  e[1] = d + INTERVAL[e[0]];
  e[4] = d;
  w[key] = e;
}

// Words met in a finished lesson but never answered yet still enter the cycle.
export function introduce(w, key) {
  if (w[key]) return;
  const d = today();
  w[key] = [1, d + 1, 0, 0, d];
}

export function dueKeys(w, limit = 20) {
  const d = today();
  return Object.keys(w).filter((k) => w[k][1] <= d)
    .sort((a, b) => w[a][0] - w[b][0] || w[a][1] - w[b][1]).slice(0, limit);
}

// Weakest first: low box, many mistakes.
export function weakKeys(w, limit = 10) {
  return Object.keys(w).filter((k) => w[k][3] > 0 || w[k][0] <= 1)
    .sort((a, b) => (w[a][0] - w[a][3]) - (w[b][0] - w[b][3])).slice(0, limit);
}

export const learnedCount = (w) => Object.values(w).filter((e) => e[0] >= 2).length;

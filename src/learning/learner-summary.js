// A compact picture of the learner, built from saved progress. The adaptive review uses it today;
// the optional AI extras (Phase 4) will send it with their prompts so answers fit the learner's level.
import { course, getMe } from '../data/progress-store.js?v=2.5.2';
import { weakKeys, learnedCount } from './srs.js?v=2.5.2';

export function learnerSummary(lang) {
  const me = getMe();
  const p = course(lang);
  const types = Object.entries(p.k).map(([type, [a, r]]) => ({ type, attempts: a, accuracy: a ? r / a : 0 }))
    .sort((x, y) => x.accuracy - y.accuracy);
  return {
    course: lang,
    level: p.c.level,
    lessonsDone: Object.keys(p.c.done).length,
    wordsLearned: learnedCount(p.w),
    wordsSeen: Object.keys(p.w).length,
    weakWords: weakKeys(p.w, 10),
    weakTypes: types.filter((t) => t.attempts >= 3).slice(0, 3),
    recentMistakes: p.x.slice(-10),
    xp: me.xp,
    streak: me.streak,
  };
}

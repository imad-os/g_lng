// Applies a finished lesson or review to the learner's saved progress.
import { course, saveCourse, getMe } from '../data/progress-store.js?v=2.5.7';
import { record, introduce, srsKey } from './srs.js?v=2.5.7';
import { starsFor, xpFor, gemsFor, addXp } from './rewards.js?v=2.5.7';
import { settleQuests } from './quests.js?v=2.5.7';
import { submitLeague } from '../data/league.js?v=2.5.7';
import { today } from './day.js?v=2.5.7';

export function finishLesson(lang, lesson, run) {
  const p = course(lang);
  const me = getMe();
  const res = run.result();
  const key = (k) => (lesson.review ? k : srsKey(lesson.unit, k));
  for (const [k, ok] of run.words) record(p.w, key(k), ok);
  for (const k of lesson.newWords || []) introduce(p.w, key(k));
  for (const [type, [a, r]] of Object.entries(run.typeStats)) {
    const s = p.k[type] || (p.k[type] = [0, 0]);
    s[0] += a; s[1] += r;
  }
  const d = today();
  for (const m of res.mistakes) p.x.push([m.id, d, m.picked]);
  const stars = starsFor(res.accuracy);
  if (!lesson.review) p.c.done[lesson.id] = Math.max(p.c.done[lesson.id] || 0, stars);
  const xp = xpFor(res);
  p.c.xp += xp;
  addXp(me, xp);
  const gems = gemsFor(res, stars);
  me.gems += gems;
  const quests = settleQuests(me, { combo: res.maxCombo, lessons: 1 });
  saveCourse(lang);
  submitLeague(me);
  return { ...res, stars, xp, gems, quests };
}

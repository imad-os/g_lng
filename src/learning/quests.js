// Daily quests: three small goals that reset every day and pay gems.
import { today } from './day.js?v=2.5.0';

export const QUESTS = [
  { id: 'xp', goal: 50, reward: 20 },
  { id: 'combo', goal: 3, reward: 10 },
  { id: 'lessons', goal: 2, reward: 15 },
];

function roll(me) {
  const d = today();
  if (me.q.day !== d) me.q = { day: d, combo: 0, lessons: 0, paid: [] };
}

export function questProgress(me) {
  roll(me);
  const value = { xp: me.dayXp, combo: me.q.combo, lessons: me.q.lessons };
  return QUESTS.map((q) => ({ ...q, value: Math.min(q.goal, value[q.id]), done: value[q.id] >= q.goal, paid: me.q.paid.includes(q.id) }));
}

// Call after XP or lessons changed. Pays every newly finished quest and returns them.
export function settleQuests(me, { combo = 0, lessons = 0 } = {}) {
  roll(me);
  me.q.combo = Math.max(me.q.combo, combo);
  me.q.lessons += lessons;
  const fresh = questProgress(me).filter((q) => q.done && !q.paid);
  for (const q of fresh) { me.q.paid.push(q.id); me.gems += q.reward; }
  return fresh;
}

// A weekly league: you against a fixed set of study buddies whose XP grows through the week.
// There is no server, so the buddies are simulated from the week number (same board on every TV).
import { today } from './day.js?v=2.2.0';

const BUDDIES = [
  ['Amine', 52], ['Sofia', 71], ['Lucas', 38], ['Yasmin', 90], ['Mateo', 60], ['Imane', 45],
  ['Hugo', 80], ['Nour', 66], ['Clara', 34], ['Karim', 100], ['Lea', 55], ['Omar', 75],
];

function noise(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

// Returns the top entries with the learner marked { me: true } and their real rank.
export function leagueBoard(me, top = 5) {
  const d = today();
  const week = Math.floor((d + 3) / 7);
  const dayInWeek = (d + 3) % 7 + 1;
  const crew = BUDDIES.map(([name, rate], i) => ({ name, xp: Math.round(rate * dayInWeek * (0.7 + 0.6 * noise(week * 31 + i))) }));
  const all = [...crew, { name: '', xp: me.weekXp, me: true }].sort((a, b) => b.xp - a.xp);
  const rank = all.findIndex((e) => e.me) + 1;
  const list = all.slice(0, top).map((e, i) => ({ ...e, rank: i + 1 }));
  if (rank > top) list[top - 1] = { ...all[rank - 1], rank };
  return { list, rank };
}

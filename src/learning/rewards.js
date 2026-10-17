// XP, gems, stars, daily goal and streak.
import { today } from './day.js?v=2.7.0';

export function starsFor(accuracy) { return accuracy >= 0.9 ? 3 : accuracy >= 0.75 ? 2 : 1; }

export function xpFor(result) { return 5 + result.firstTryRight + (result.accuracy === 1 ? 5 : 0); }

// Gems: 1 per star, 3 more for a perfect lesson.
export function gemsFor(result, stars) { return stars + (result.accuracy === 1 ? 3 : 0); }

export function addXp(me, xp) {
  const d = today();
  if (me.day !== d) { me.day = d; me.dayXp = 0; }
  me.xp += xp;
  me.dayXp += xp;
  me.weekXp += xp;
  if (me.streakDay !== d) {
    me.streak = me.streakDay === d - 1 ? me.streak + 1 : 1;
    me.streakDay = d;
  }
}

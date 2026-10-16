// Global weekly league over Firestore REST. Each player writes only their own document league/w<week>/players/<id>
// ({name, xp}); anyone can read the top list. Scores are not verified (there is no login), the rules only cap the growth.
import { firebaseConfig } from './firebase-config.js?v=2.4.0';
import { decodeFields } from './firestore.js?v=2.4.0';

const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents/`;
const key = '?key=' + encodeURIComponent(firebaseConfig.apiKey);
const weekPath = (week) => `league/w${week}/players`;

// A random id per install (the profile id on a TV is not unique across TVs).
export function ensureIdentity(me, profileName) {
  if (!/^[a-z0-9]{16,32}$/.test(me.uid || '')) {
    const a = new Uint8Array(10);
    (self.crypto || window.crypto).getRandomValues(a);
    me.uid = Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  }
  if (!me.name) me.name = cleanName(profileName) || `Learner ${me.uid.slice(0, 4)}`;
}

export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);

export function leagueEnabled(me) { return me.league !== false; }

// Sends this week's XP when it changed. Never throws: the league must not break learning.
export async function submitLeague(me) {
  try {
    if (!leagueEnabled(me) || !me.uid || me.weekXp <= 0) return false;
    const stamp = `${me.week}:${me.weekXp}:${me.name}`;
    if (me.lgSent === stamp) return true;
    const url = root + weekPath(me.week) + '/' + me.uid + key;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { name: { stringValue: cleanName(me.name) }, xp: { integerValue: String(Math.round(me.weekXp)) } } }),
    });
    if (!res.ok) return false;
    me.lgSent = stamp;
    return true;
  } catch (e) { return false; }
}

// Top players this week, best first: [{id, name, xp}]. Throws when offline.
export async function topPlayers(week, n = 20) {
  const res = await fetch(`${root}${weekPath(week)}${key}&orderBy=${encodeURIComponent('xp desc')}&pageSize=${n}`);
  if (!res.ok) throw new Error('league ' + res.status);
  const data = await res.json();
  return (data.documents || []).map((d) => {
    const f = decodeFields(d.fields || {});
    return { id: d.name.split('/').pop(), name: String(f.name || '?'), xp: Number(f.xp) || 0 };
  });
}

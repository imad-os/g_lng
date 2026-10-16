// 60-second Blitz: as many quick questions as you can, +2 XP per right answer, from words you already met.
import { h, focusable, clear } from '../../platform/dom.js?v=2.5.7';
import { t } from '../../platform/i18n.js?v=2.5.7';
import { focusFirst, setFocus } from '../../platform/input.js?v=2.5.7';
import { say, sfx, stopVoice } from '../../platform/audio.js?v=2.5.7';
import { getLexicon, getLevel } from '../../data/content-repo.js?v=2.5.7';
import { course as progressOf, getMe, saveCourse } from '../../data/progress-store.js?v=2.5.7';
import { record } from '../../learning/srs.js?v=2.5.7';
import { submitLeague } from '../../data/league.js?v=2.5.7';
import { addXp } from '../../learning/rewards.js?v=2.5.7';
import { settleQuests } from '../../learning/quests.js?v=2.5.7';
import { mascot } from '../mascot.js?v=2.5.7';
import pick from '../exercises/pick.js?v=2.5.7';
import { shuffle } from '../exercises/common.js?v=2.5.7';

const SECONDS = 60;

// Words the learner has met (their units' lexicons); a brand-new learner gets the current level's first unit.
async function loadPool(app) {
  const p = progressOf(app.lang);
  let units = [...new Set(Object.keys(p.w).map((k) => k.split('|')[0]))].slice(-4);
  if (!units.length) {
    const level = await getLevel(app.lang, p.c.level).catch(() => null);
    units = level && level.units.length ? [level.units[0].id] : [];
  }
  const vocab = {};
  for (const u of units) {
    const lex = await getLexicon(app.lang, u).catch(() => null);
    if (lex) for (const [k, v] of Object.entries(lex.words)) vocab[`${u}|${k}`] = v;
  }
  return vocab;
}

export function blitzScreen(app) {
  const me = getMe();
  const p = progressOf(app.lang);
  const course = app.courseDoc;
  const root = h('div', { class: 'blitz' });
  const bar = h('i', { style: 'transform: scaleX(1)' });
  const score = h('b', null, '0');
  const area = h('div', { class: 'ex-area' });
  let vocab = {}, keys = [], right = 0, asked = 0, left = SECONDS, tick = 0, over = false, nextTimer = 0, last = '';

  function question() {
    if (over) return;
    clear(area);
    let k;
    do { k = keys[Math.floor(Math.random() * keys.length)]; } while (keys.length > 1 && k === last);
    last = k;
    const others = shuffle(keys.filter((o) => o !== k && vocab[o].t !== vocab[k].t)).slice(0, 3);
    const ex = { id: `blitz${asked}`, type: Math.random() < 0.5 ? 'pick_translation' : 'pick_target', item: k, opts: shuffle([k, ...others]) };
    const ui = pick({
      ex, vocab, from: app.from, course,
      say: (key, slow) => say(vocab[key], course.tts, slow),
      answer: (ok) => {
        asked++;
        record(p.w, k, ok);
        if (ok) { right++; score.textContent = String(right); sfx('right', Math.min(right, 8)); } else sfx('wrong');
        nextTimer = setTimeout(question, ok ? 350 : 800);
      },
    });
    area.appendChild(ui.el);
    focusFirst();
  }

  function end() {
    over = true;
    clearInterval(tick); clearTimeout(nextTimer); stopVoice();
    const xp = right * 2;
    const gems = Math.floor(right / 5);
    addXp(me, xp);
    me.gems += gems;
    const quests = settleQuests(me, {});
    saveCourse(app.lang);
    submitLeague(me);
    sfx(right >= 5 ? 'done' : 'fail');
    if (quests.length) setTimeout(() => sfx('quest'), 900);
    clear(root);
    const again = focusable(h('button', { class: 'btn primary wide', data: { autofocus: '' } }, t('again')), () => app.go.blitz());
    const home = focusable(h('button', { class: 'btn' }, t('home')), () => app.go.home());
    root.appendChild(h('div', { class: 'results' }, mascot(right >= 5 ? 'cheer' : 'happy', 140), h('h1', null, t('blitzOver')),
      h('div', { class: 'result-tiles' },
        h('div', { class: 'card' }, h('div', { class: 'muted small' }, t('correct')), h('div', { class: 'big-num' }, String(right))),
        h('div', { class: 'card' }, h('div', { class: 'muted small' }, t('earned')), h('div', { class: 'big-num' }, `${t('xp', { n: xp })}${gems ? ` · +${gems}💎` : ''}`))),
      quests.length ? h('div', { class: 'quest-won' }, quests.map((q) => h('div', null, '🎯 ', t(`quest.${q.id}`, { n: q.goal }), ` +${q.reward}💎`))) : null,
      h('div', { class: 'row-gap' }, again, home)));
    setFocus(again);
  }

  return {
    el: root,
    onBack: () => { over = true; clearInterval(tick); clearTimeout(nextTimer); stopVoice(); app.go.home(); },
    menu: [{ id: 'quit', label: t('menuHome') }],
    onMenu: () => app.go.home(),
    destroy: () => { over = true; clearInterval(tick); clearTimeout(nextTimer); stopVoice(); },
    async mounted() {
      root.appendChild(h('div', { class: 'boot' }, t('loading')));
      vocab = await loadPool(app);
      keys = Object.keys(vocab);
      if (keys.length < 4) { app.go.home(); return; }
      clear(root);
      root.append(h('div', { class: 'lesson-top' }, h('span', { class: 'combo' }, '⚡ ', t('blitz')), h('div', { class: 'bar grow' }, bar), h('span', { class: 'counter' }, '✓ ', score)), area);
      question();
      tick = setInterval(() => {
        left -= 0.1;
        bar.style.transform = `scaleX(${Math.max(0, left / SECONDS)})`;
        if (Math.abs(left - Math.round(left)) < 0.05 && left <= 5 && left > 0) sfx('tick');
        if (left <= 0) end();
      }, 100);
    },
  };
}

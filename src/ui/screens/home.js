// Home: left rail (coach, blitz, quests, review), the winding course path in the middle, right rail (league, AI).
import { h, focusable, clear, ICONS } from '../../platform/dom.js?v=2.5.6';
import { t, pickLang } from '../../platform/i18n.js?v=2.5.6';
import { focusFirst, setFocus } from '../../platform/input.js?v=2.5.6';
import { getLevel } from '../../data/content-repo.js?v=2.5.6';
import { course as progressOf, getMe, saveCourse, saveMe } from '../../data/progress-store.js?v=2.5.6';
import { lessonState, levelComplete, nextLesson } from '../../learning/path.js?v=2.5.6';
import { dueKeys } from '../../learning/srs.js?v=2.5.6';
import { questProgress } from '../../learning/quests.js?v=2.5.6';
import { setSfx, sfx } from '../../platform/audio.js?v=2.5.6';
import { openDialog, toast, starsRow } from '../components.js?v=2.5.6';
import { topPlayers, submitLeague } from '../../data/league.js?v=2.5.6';
import { mascot } from '../mascot.js?v=2.5.6';

const WIGGLE = [0, 56, 88, 56, 0, -56, -88, -56];
const THEMES = ['food', 'travel', 'family', 'work', 'health', 'shopping'];

export function homeScreen(app) {
  const me = getMe();
  const p = progressOf(app.lang);
  const course = app.courseDoc;
  const tabs = h('div', { class: 'level-tabs' });
  const body = h('div', { class: 'path' });
  const levelDocs = {};
  const ai = app.ai;

  // --- top bar -----------------------------------------------------------
  const goalPct = Math.min(1, me.dayXp / me.goal);
  const sfxBtn = focusable(h('button', { class: 'chip icon-chip', 'aria-label': t('sound') }, me.sfx ? '🔊' : '🔇'), () => {
    me.sfx = !me.sfx; setSfx(me.sfx); saveMe(); sfxBtn.textContent = me.sfx ? '🔊' : '🔇'; if (me.sfx) sfx('pick');
  });
  const top = h('div', { class: 'topbar' },
    focusable(h('button', { class: 'chip course-chip' }, h('b', { class: course.script === 'Tifinagh' ? 'tfng' : '', dir: 'auto' }, course.native), pickLang(course.name)), () => app.go.courses()),
    h('span', { class: 'chip', title: t('streakTitle'), html: ICONS.fire }, String(me.streak)),
    h('span', { class: 'chip' }, '💎 ', String(me.gems)),
    h('span', { class: 'chip' }, '⚡ ', String(me.xp)),
    h('div', { class: 'goal' }, h('span', { class: 'small muted' }, `${t('today')} ${me.dayXp}/${me.goal} XP`), h('div', { class: 'bar' }, h('i', { style: `transform: scaleX(${goalPct})` }))),
    h('span', { class: 'grow' }),
    sfxBtn,
    focusable(h('button', { class: 'btn small-btn' }, t('stats')), () => app.go.stats()),
    focusable(h('button', { class: 'btn small-btn' }, t('settings')), () => app.go.settings()));

  // --- left rail ---------------------------------------------------------
  const tips = t('coachTips');
  const due = dueKeys(p.w, 99).length;
  const coachCard = h('div', { class: 'rail-card' },
    h('div', { class: 'coach-row' }, mascot('happy', 64), h('p', { class: 'bubble-tip small' }, tips[(me.day + me.streak) % tips.length])),
    focusable(h('button', { class: 'btn gold wide-rail' }, '⚡ ', t('blitz')), () => app.go.blitz()));
  const quests = h('div', { class: 'rail-card' }, h('h3', null, '🎯 ', t('quests')),
    questProgress(me).map((q) => h('div', { class: 'quest' },
      h('div', { class: 'quest-top small' }, h('span', null, t(`quest.${q.id}`, { n: q.goal })), h('span', { class: q.done ? 'done' : '' }, q.paid || q.done ? '✓' : `+${q.reward}💎`)),
      h('div', { class: 'bar thin' }, h('i', { style: `transform: scaleX(${q.value / q.goal})` })))));
  const reviewCard = h('div', { class: 'rail-card review-card' },
    h('h3', null, '🧠 ', t('weakWordsTitle')), h('div', { class: 'small muted' }, due ? t('dueWords', { n: due }) : t('nothingDue')),
    focusable(h('button', { class: 'btn purple wide-rail' }, t('review')), () => app.go.review()));
  const left = h('aside', { class: 'rail left' }, coachCard, quests, reviewCard);

  // --- right rail --------------------------------------------------------
  const aiCard = h('div', { class: 'rail-card' }, h('h3', null, '✨ ', t('aiTitle')),
    focusable(h('button', { class: 'btn blue wide-rail' }, t('aiLesson')), () => aiGate(askTheme)),
    focusable(h('button', { class: 'btn wide-rail' }, '💬 ', t('chatTitle')), () => aiGate(() => app.go.chat())),
    focusable(h('button', { class: 'btn wide-rail' }, '📖 ', t('explainUnit')), () => aiGate(explainUnit)));
  const leagueList = h('div', { class: 'league-list' }, h('div', { class: 'small muted' }, '…'));
  const leagueCard = h('div', { class: 'rail-card league-card' }, h('h3', null, '🏆 ', t('league')), leagueList,
    h('div', { class: 'small muted' }, t('leagueResets')));
  const right = h('aside', { class: 'rail right' }, leagueCard, aiCard);

  async function loadLeague() {
    try {
      await submitLeague(me);
      const list = await topPlayers(me.week, 8);
      clear(leagueList);
      if (!list.length) { leagueList.appendChild(h('div', { class: 'small muted' }, t('leagueEmpty'))); return; }
      list.forEach((r, i) => leagueList.appendChild(h('div', { class: `league-row ${r.id === me.uid ? 'me' : ''}` },
        h('span', { class: 'rk' }, String(i + 1)), h('span', { class: 'nm', dir: 'auto' }, r.id === me.uid ? `${r.name} (${t('leagueYou')})` : r.name), h('span', { class: 'xp' }, String(r.xp)))));
      if (me.weekXp > 0 && !list.some((r) => r.id === me.uid)) leagueList.appendChild(h('div', { class: 'small muted' }, t('leagueOutside', { xp: me.weekXp })));
    } catch (e) { clear(leagueList); leagueList.appendChild(h('div', { class: 'small muted' }, t('leagueOffline'))); }
  }
  loadLeague();

  function aiGate(fn) {
    if (ai && ai.ready()) { fn(); return; }
    toast(t('aiOff'));
  }

  function askTheme() {
    const body = h('div', { class: 'theme-grid' });
    const close = openDialog({ title: t('aiLesson'), text: t('pickTheme'), body, buttons: [{ label: t('cancel'), kind: 'primary' }] });
    for (const th of THEMES) body.appendChild(focusable(h('button', { class: 'btn small-btn' }, t(`themes.${th}`)), () => { close(); app.go.aiLesson(t(`themes.${th}`)); }));
    setFocus(body.firstChild);
  }

  async function explainUnit() {
    const next = currentLevel() && nextLesson(currentLevel(), p.c.done);
    const unitId = next ? next.unit.id : null;
    if (!unitId) { toast(t('levelEmpty')); return; }
    const text = h('p', { class: 'ai-text' }, t('thinking'));
    openDialog({ title: t('explainUnit'), body: text, buttons: [{ label: t('close'), kind: 'primary' }] });
    try { text.textContent = await ai.explainUnit(unitId); } catch (e) { text.textContent = e.message || t('loadFailed'); }
  }

  // --- the path ----------------------------------------------------------
  const currentLevel = () => levelDocs[p.c.level];

  async function loadLevels() {
    const docs = await Promise.all(course.levels.map((l) => (l.units ? getLevel(app.lang, l.id).catch(() => null) : null)));
    course.levels.forEach((l, i) => { levelDocs[l.id] = docs[i]; });
  }

  function levelOpen(i) {
    if (i === 0 || i <= (p.c.placed || 0)) return true;
    const prev = levelDocs[course.levels[i - 1].id];
    return !!prev && levelComplete(prev, p.c.done);
  }

  function renderTabs() {
    clear(tabs);
    course.levels.forEach((l, i) => {
      const open = levelOpen(i);
      tabs.appendChild(focusable(h('button', { class: `level-tab ${l.id === p.c.level ? 'active' : ''} ${open ? '' : 'locked'}`, title: pickLang(l.title) }, l.code), () => {
        if (!open) { toast(t('levelLocked', { level: course.levels[i - 1].code })); return; }
        p.c.level = l.id; saveCourse(app.lang);
        renderTabs(); renderLevel(true);
      }));
    });
  }

  function renderLevel(focusNext) {
    clear(body);
    const meta = course.levels.find((l) => l.id === p.c.level) || course.levels[0];
    const level = levelDocs[meta.id];
    body.appendChild(h('div', { class: 'level-head' }, h('h2', null, `${meta.code} · ${pickLang(meta.title)}`)));
    if (!level || !level.units.length) { body.appendChild(h('div', { class: 'card empty' }, t('levelEmpty'))); if (focusNext) focusFirst(); return; }
    const next = nextLesson(level, p.c.done);
    let nextEl = null;
    level.units.forEach((u, ui) => {
      const nodes = h('div', { class: 'nodes' });
      u.lessons.forEach((l, li) => {
        const state = lessonState(level, l.id, p.c.done);
        const icon = l.type === 'story' ? h('span', { html: ICONS.chat }) : l.type === 'review' ? h('span', { html: ICONS.trophy }) : String(l.order);
        const node = focusable(h('button', { class: `node ${state} ${l.type}`, style: `left: ${WIGGLE[li % WIGGLE.length]}px`, title: pickLang(l.title) },
          h('span', { class: 'disc' }, state === 'locked' ? h('span', { html: ICONS.lock }) : icon),
          h('span', { class: 'node-text' },
            h('span', { class: 'node-label small', dir: 'auto' }, l.type === 'learn' ? pickLang(l.title, app.from) : t(`lessonTypes.${l.type}`)),
            state === 'done' ? starsRow(p.c.done[l.id]) : null)), () => {
          if (state === 'locked') { sfx('wrong'); toast(t('locked')); return; }
          sfx('tap');
          app.go.lesson(l.id);
        });
        if (next && next.lesson.id === l.id) { node.dataset.autofocus = ''; node.classList.add('next'); nextEl = node; }
        nodes.appendChild(node);
      });
      const tip = focusable(h('button', { class: 'btn small-btn' }, t('tip')), async () => {
        const unit = await app.getUnit(u.id);
        openDialog({ title: `${t('unit', { n: ui + 1 })} · ${pickLang(u.title)}`, text: unit ? pickLang(unit.tip) : '', buttons: [{ label: t('close'), kind: 'primary' }] });
      });
      body.appendChild(h('section', { class: 'unit' },
        h('div', { class: 'unit-head' }, h('div', null, h('div', { class: 'muted small' }, t('unit', { n: ui + 1 })), h('h3', null, pickLang(u.title))), tip),
        nodes));
    });
    if (focusNext) { if (nextEl) setFocus(nextEl); else focusFirst(); }
  }

  const go = { review: app.go.review, blitz: app.go.blitz, stats: app.go.stats, settings: app.go.settings, courses: app.go.courses, admin: app.go.admin };
  return {
    el: h('div', { class: 'home' }, top, h('div', { class: 'home-body' }, left, h('div', { class: 'center' }, tabs, body), right)),
    menu: [{ id: 'blitz', label: t('blitz') }, { id: 'review', label: t('review') }, { id: 'stats', label: t('stats') }, { id: 'settings', label: t('settings') }, { id: 'courses', label: t('myLanguages') }, { id: 'admin', label: t('adminTitle') }],
    onMenu: (id) => go[id](),
    onBack: () => app.MyPC.pause(),
    async mounted() {
      await loadLevels();
      if (!course.levels.some((l) => l.id === p.c.level)) p.c.level = course.levels[0].id;
      renderTabs();
      renderLevel(true);
    },
  };
}

// Home: the course path. Levels across the top, units and their lessons below, next lesson focused.
import { h, focusable, clear, ICONS } from '../../platform/dom.js?v=2.1.0';
import { t, pickLang } from '../../platform/i18n.js?v=2.1.0';
import { focusFirst, setFocus } from '../../platform/input.js?v=2.1.0';
import { getLevel } from '../../data/content-repo.js?v=2.1.0';
import { course as progressOf, getMe, saveCourse } from '../../data/progress-store.js?v=2.1.0';
import { lessonState, levelComplete, nextLesson } from '../../learning/path.js?v=2.1.0';
import { openDialog, toast, starsRow } from '../components.js?v=2.1.0';

export function homeScreen(app) {
  const me = getMe();
  const p = progressOf(app.lang);
  const course = app.courseDoc;
  const body = h('div', { class: 'path' });
  const tabs = h('div', { class: 'level-tabs' });
  let levelDocs = {};

  const goalPct = Math.min(1, me.dayXp / me.goal);
  const top = h('div', { class: 'topbar' },
    focusable(h('button', { class: 'chip course-chip' }, h('b', { class: course.script === 'Tifinagh' ? 'tfng' : '', dir: 'auto' }, course.native), pickLang(course.name)), () => app.go.courses()),
    h('span', { class: 'chip', html: ICONS.fire }, String(me.streak)),
    h('div', { class: 'goal' }, h('span', { class: 'small muted' }, `${t('today')} ${me.dayXp}/${me.goal} XP`), h('div', { class: 'bar' }, h('i', { style: `transform: scaleX(${goalPct})` }))),
    h('span', { class: 'grow' }),
    focusable(h('button', { class: 'btn blue' }, t('review')), () => app.go.review()),
    focusable(h('button', { class: 'btn' }, t('stats')), () => app.go.stats()),
    focusable(h('button', { class: 'btn' }, t('settings')), () => app.go.settings()));

  async function loadLevels() {
    const docs = await Promise.all(course.levels.map((l) => (l.units ? getLevel(app.lang, l.id).catch(() => null) : null)));
    course.levels.forEach((l, i) => { levelDocs[l.id] = docs[i]; });
  }

  function levelOpen(i) {
    if (i === 0) return true;
    const prev = levelDocs[course.levels[i - 1].id];
    return !!prev && levelComplete(prev, p.c.done);
  }

  function renderTabs() {
    clear(tabs);
    course.levels.forEach((l, i) => {
      const open = levelOpen(i);
      const tab = focusable(h('button', { class: `level-tab ${l.id === p.c.level ? 'active' : ''} ${open ? '' : 'locked'}`, title: pickLang(l.title) }, l.code), () => {
        if (!open) { toast(t('levelLocked', { level: course.levels[i - 1].code })); return; }
        p.c.level = l.id; saveCourse(app.lang);
        renderTabs(); renderLevel(true);
      });
      tabs.appendChild(tab);
    });
  }

  function renderLevel(focusNext) {
    clear(body);
    const meta = course.levels.find((l) => l.id === p.c.level) || course.levels[0];
    const level = levelDocs[meta.id];
    body.appendChild(h('div', { class: 'level-head' }, h('h2', null, `${meta.code} · ${pickLang(meta.title)}`), level ? h('div', { class: 'muted' }, pickLang(level.goal)) : null));
    if (!level || !level.units.length) { body.appendChild(h('div', { class: 'card empty' }, t('levelEmpty'))); if (focusNext) focusFirst(); return; }
    const next = nextLesson(level, p.c.done);
    let nextEl = null;
    level.units.forEach((u, ui) => {
      const nodes = h('div', { class: 'nodes' });
      u.lessons.forEach((l) => {
        const state = lessonState(level, l.id, p.c.done);
        const icon = l.type === 'story' ? h('span', { html: ICONS.chat }) : l.type === 'review' ? h('span', { html: ICONS.trophy }) : String(l.order);
        const node = focusable(h('button', { class: `node ${state} ${l.type}`, title: pickLang(l.title) },
          h('span', { class: 'disc' }, state === 'locked' ? h('span', { html: ICONS.lock }) : icon),
          h('span', { class: 'node-label small', dir: 'auto' }, l.type === 'learn' ? pickLang(l.title, app.from) : t(`lessonTypes.${l.type}`)),
          state === 'done' ? starsRow(p.c.done[l.id]) : null), () => {
          if (state === 'locked') { toast(t('locked')); return; }
          app.go.lesson(l.id);
        });
        if (next && next.lesson.id === l.id) { node.dataset.autofocus = ''; nextEl = node; }
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

  return {
    el: h('div', { class: 'home' }, top, tabs, body),
    menu: [{ id: 'review', label: t('review') }, { id: 'stats', label: t('stats') }, { id: 'settings', label: t('settings') }, { id: 'courses', label: t('course') }],
    onMenu: (id) => ({ review: app.go.review, stats: app.go.stats, settings: app.go.settings, courses: app.go.courses })[id](),
    onBack: () => app.MyPC.pause(),
    async mounted() {
      await loadLevels();
      if (!course.levels.some((l) => l.id === p.c.level)) p.c.level = course.levels[0].id;
      renderTabs();
      renderLevel(true);
    },
  };
}

// My languages: every course you have started with its progress, and a card to add another one.
import { h, focusable } from '../../platform/dom.js?v=2.5.7';
import { t, pickLang } from '../../platform/i18n.js?v=2.5.7';
import { getMe } from '../../data/progress-store.js?v=2.5.7';
import { course as progressOf } from '../../data/progress-store.js?v=2.5.7';
import { learnerSummary } from '../../learning/learner-summary.js?v=2.5.7';

export function coursesScreen(app) {
  const me = getMe();
  const grid = h('div', { class: 'course-grid' });
  for (const id of me.started) {
    const c = app.catalog.courses.find((x) => x.id === id);
    if (!c) continue;
    const p = progressOf(id);
    const lvl = c.levels.indexOf(p.c.level) >= 0 ? p.c.level.toUpperCase() : '';
    const s = learnerSummary(id);
    grid.appendChild(focusable(h('button', { class: `course-card${app.lang === id ? ' current' : ''}`, data: app.lang === id ? { autofocus: '' } : {} },
      h('span', { class: `native${id === 'zgh' ? ' tfng' : ''}`, dir: 'auto' }, c.native),
      pickLang(c.name) !== c.native ? h('span', { class: 'name' }, pickLang(c.name)) : null,
      h('span', { class: 'muted small' }, `${lvl} · ${t('xp', { n: p.c.xp })} · ${s.lessonsDone} ${t('lessonsDone').toLowerCase()}`)), () => app.go.pickCourse(id)));
  }
  grid.appendChild(focusable(h('button', { class: 'course-card add', data: me.started.length ? {} : { autofocus: '' } },
    h('span', { class: 'native' }, '+'), h('span', { class: 'name' }, t('addLanguage'))), () => app.go.learnWhat()));
  const back = app.lang ? focusable(h('button', { class: 'btn' }, t('back')), () => app.go.home()) : null;
  return {
    el: h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, t('myLanguages')), back), grid),
    onBack: () => { if (app.lang) app.go.home(); },
  };
}

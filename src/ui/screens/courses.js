// Pick the language to learn.
import { h, focusable } from '../../platform/dom.js?v=2.0.0';
import { t, pickLang } from '../../platform/i18n.js?v=2.0.0';

export function coursesScreen(app) {
  const grid = h('div', { class: 'course-grid' });
  for (const c of app.catalog.courses) {
    const ready = c.ready && c.ready.length > 0;
    const card = focusable(h('button', { class: `course-card${app.lang === c.id ? ' current' : ''}${ready ? '' : ' soon'}`, data: app.lang === c.id ? { autofocus: '' } : {} },
      h('span', { class: `native${c.id === 'zgh' ? ' tfng' : ''}`, dir: 'auto' }, c.native),
      pickLang(c.name) !== c.native ? h('span', { class: 'name' }, pickLang(c.name)) : null,
      h('span', { class: 'muted small' }, ready ? `${c.levels.length} ${t('levels')}` : t('comingSoon'))), () => app.go.pickCourse(c.id));
    grid.appendChild(card);
  }
  return {
    el: h('div', { class: 'page' }, h('h1', null, t('chooseCourse')), grid),
    onBack: () => { if (app.lang) app.go.home(); },
  };
}

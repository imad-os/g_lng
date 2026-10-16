// After a lesson: stars, XP, accuracy.
import { h, focusable } from '../../platform/dom.js?v=2.0.0';
import { t } from '../../platform/i18n.js?v=2.0.0';
import { starsRow } from '../components.js?v=2.0.0';

export function resultsScreen(app, lesson, result) {
  const title = lesson.review ? t('reviewDone') : t('lessonDone');
  const cont = focusable(h('button', { class: 'btn primary wide', data: { autofocus: '' } }, t('continue')), () => app.go.home());
  return {
    el: h('div', { class: 'results' },
      h('h1', null, title),
      lesson.review ? null : starsRow(result.stars),
      h('div', { class: 'result-tiles' },
        h('div', { class: 'card tile-xp' }, h('div', { class: 'muted small' }, t('earned')), h('div', { class: 'big-num' }, t('xp', { n: result.xp }))),
        h('div', { class: 'card tile-acc' }, h('div', { class: 'muted small' }, t('accuracy')), h('div', { class: 'big-num' }, `${Math.round(result.accuracy * 100)}%`))),
      cont),
    mounted: () => app.MyPC.announce(`${title} ${t('xp', { n: result.xp })}`),
    onBack: () => app.go.home(),
  };
}

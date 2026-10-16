// After a lesson: stars, XP, gems, accuracy, best combo and any quest finished on the way.
import { h, focusable } from '../../platform/dom.js?v=2.3.0';
import { t } from '../../platform/i18n.js?v=2.3.0';
import { sfx } from '../../platform/audio.js?v=2.3.0';
import { starsRow } from '../components.js?v=2.3.0';
import { mascot } from '../mascot.js?v=2.3.0';

export function resultsScreen(app, lesson, result) {
  const title = lesson.review ? t('reviewDone') : t('lessonDone');
  const cont = focusable(h('button', { class: 'btn primary wide', data: { autofocus: '' } }, t('continue')), () => app.go.home());
  const tile = (label, value) => h('div', { class: 'card' }, h('div', { class: 'muted small' }, label), h('div', { class: 'big-num' }, value));
  return {
    el: h('div', { class: 'results' },
      mascot(result.accuracy >= 0.75 ? 'cheer' : 'happy', 130),
      h('h1', null, title),
      lesson.review ? null : starsRow(result.stars),
      h('div', { class: 'result-tiles' },
        tile(t('earned'), t('xp', { n: result.xp })),
        tile(t('gems'), `+${result.gems || 0} 💎`),
        tile(t('accuracy'), `${Math.round(result.accuracy * 100)}%`),
        tile(t('maxCombo'), `${result.maxCombo || 0}x 🔥`)),
      result.quests && result.quests.length ? h('div', { class: 'quest-won' }, result.quests.map((q) => h('div', null, '🎯 ', t(`quest.${q.id}`, { n: q.goal }), ` · +${q.reward} 💎`))) : null,
      cont),
    mounted: () => {
      app.MyPC.announce(`${title} ${t('xp', { n: result.xp })}`);
      if (result.quests && result.quests.length) setTimeout(() => sfx('quest'), 700);
      else if (result.gems) setTimeout(() => sfx('gem'), 500);
    },
    onBack: () => app.go.home(),
  };
}

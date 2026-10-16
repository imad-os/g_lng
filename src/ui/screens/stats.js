// Progress: totals, accuracy per exercise type, words to practise.
import { h, focusable } from '../../platform/dom.js?v=2.5.3';
import { t, pickLang } from '../../platform/i18n.js?v=2.5.3';
import { getLexicon } from '../../data/content-repo.js?v=2.5.3';
import { course as progressOf, getMe } from '../../data/progress-store.js?v=2.5.3';
import { learnerSummary } from '../../learning/learner-summary.js?v=2.5.3';
import { itemText } from '../components.js?v=2.5.3';

export function statsScreen(app) {
  const me = getMe();
  const p = progressOf(app.lang);
  const s = learnerSummary(app.lang);
  const weak = h('div', { class: 'weak-list' }, h('div', { class: 'muted' }, t('noWeakWords')));
  const tile = (label, value) => h('div', { class: 'card stat' }, h('div', { class: 'muted small' }, label), h('div', { class: 'big-num' }, value));
  const types = Object.entries(p.k).filter(([, [a]]) => a > 0).map(([type, [a, r]]) =>
    h('div', { class: 'type-row' }, h('span', null, t(`prompts.${type}`)), h('div', { class: 'bar' }, h('i', { style: `transform: scaleX(${r / a})` })), h('span', { class: 'small' }, `${Math.round((r / a) * 100)}%`)));
  const back = focusable(h('button', { class: 'btn', data: { autofocus: '' } }, t('back')), () => app.go.home());

  return {
    el: h('div', { class: 'page stats-page' },
      h('div', { class: 'page-head' }, h('h1', null, `${t('statsTitle')} · ${pickLang(app.courseDoc.name)}`), back),
      h('div', { class: 'stat-tiles' },
        tile(t('totalXp'), String(me.xp)), tile(t('dailyGoal'), `${me.dayXp}/${me.goal}`),
        tile(t('wordsLearned'), String(s.wordsLearned)), tile(t('lessonsDone'), String(s.lessonsDone))),
      h('div', { class: 'stats-cols' },
        h('div', { class: 'card' }, h('h3', null, t('byType')), types.length ? types : h('div', { class: 'muted' }, '—')),
        h('div', { class: 'card' }, h('h3', null, t('weakWords')), weak))),
    onBack: () => app.go.home(),
    async mounted() {
      if (!s.weakWords.length) return;
      const units = [...new Set(s.weakWords.map((k) => k.split('|')[0]))];
      const lex = {};
      for (const u of units) { try { lex[u] = await getLexicon(app.lang, u); } catch (e) { lex[u] = null; } }
      weak.textContent = '';
      for (const k of s.weakWords) {
        const [u, w] = k.split('|');
        const v = lex[u] && lex[u].words[w];
        if (v) weak.appendChild(h('div', { class: 'weak-row' }, itemText(v, app.courseDoc), h('span', { class: 'muted', dir: 'auto' }, v.g[app.from] || v.g.en)));
      }
    },
  };
}

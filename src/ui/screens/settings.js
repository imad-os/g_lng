// Settings: translation language, daily goal, device voice, reset course.
import { h, focusable } from '../../platform/dom.js?v=2.7.0';
import { t, UI_LANGS } from '../../platform/i18n.js?v=2.7.0';
import { configureAudio, setSfx } from '../../platform/audio.js?v=2.7.0';
import { getMe, saveMe, resetCourse } from '../../data/progress-store.js?v=2.7.0';
import { openDialog, toast } from '../components.js?v=2.7.0';

const LANG_NAMES = { en: 'English', fr: 'Français', es: 'Español', ar: 'العربية' };
const GOALS = [10, 20, 30, 50];

export function settingsScreen(app) {
  const me = getMe();
  const rows = h('div', { class: 'settings' });

  function row(label, getValue, onSelect, extra) {
    const v = h('b', { dir: 'auto' }, getValue());
    const el = focusable(h('button', { class: 'setting-row' }, h('span', null, label), v), () => { onSelect(); v.textContent = getValue(); });
    if (extra) Object.assign(el.dataset, extra);
    rows.appendChild(el);
  }

  const fromChoices = UI_LANGS.filter((l) => l !== app.lang);
  row(t('fromLanguage'), () => LANG_NAMES[me.from], () => {
    me.from = fromChoices[(fromChoices.indexOf(me.from) + 1) % fromChoices.length];
    app.from = me.from; saveMe();
  }, { autofocus: '' });
  row(t('dailyGoal'), () => t('goal', { n: me.goal }), () => { me.goal = GOALS[(GOALS.indexOf(me.goal) + 1) % GOALS.length]; saveMe(); });
  row(t('speech'), () => (me.speech ? t('on') : t('off')), () => {
    me.speech = !me.speech; saveMe();
    configureAudio({ base: app.config.audioBase, speech: me.speech && app.config.speech });
  });
  row(t('sound'), () => (me.sfx ? t('on') : t('off')), () => { me.sfx = !me.sfx; setSfx(me.sfx); saveMe(); });
  const admin = focusable(h('button', { class: 'setting-row' }, h('span', null, t('adminTitle')), h('b', null, '›')), () => app.go.admin());
  rows.appendChild(admin);
  const reset = focusable(h('button', { class: 'btn danger' }, t('resetCourse')), () => openDialog({
    title: t('resetTitle'), text: t('resetText'),
    buttons: [{ label: t('reset'), kind: 'danger', onSelect: () => { resetCourse(app.lang); toast(t('reset')); app.go.home(); } }, { label: t('cancel'), kind: 'primary' }],
  }));
  const back = focusable(h('button', { class: 'btn' }, t('back')), () => app.go.home());

  return {
    el: h('div', { class: 'page settings-page' }, h('div', { class: 'page-head' }, h('h1', null, t('settingsTitle')), back), rows, h('div', { class: 'settings-foot' }, reset)),
    onBack: () => app.go.home(),
  };
}

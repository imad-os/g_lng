// AI settings: only the switches live here. Providers, models, addresses and API keys are set by the owner in the
// My PC App Store Manager (Config -> MyPC.app_config), so nothing secret is typed on the TV. Everything works with arrows + OK.
import { h, focusable } from '../../platform/dom.js?v=2.6.0';
import { t } from '../../platform/i18n.js?v=2.6.0';
import { aiConfig, saveAiConfig } from '../../ai/config.js?v=2.6.0';
import { testConnection } from '../../ai/client.js?v=2.6.0';
import { openDialog, toast } from '../components.js?v=2.6.0';

const NAMES = { nvidia: 'NVIDIA NIM', gemini: 'Google Gemini', openai: 'OpenAI', riva: 'NVIDIA Riva', magpie: 'NVIDIA Magpie', webspeech: null, offline: null };

export function adminScreen(app) {
  const cfg = aiConfig();
  const form = h('div', { class: 'adm-form' });
  const banner = h('div', { class: 'adm-banner', role: 'status', hidden: true });
  let first = true;

  const section = (title) => form.appendChild(h('h2', { class: 'adm-section' }, title));
  const addRow = (label, getValue, onSelect) => {
    const v = h('b', { class: 'adm-value', dir: 'auto' }, getValue());
    const el = focusable(h('button', { class: 'adm-row' }, h('span', { class: 'adm-label' }, label), v), () => onSelect(() => { v.textContent = getValue(); }));
    if (first) { el.dataset.autofocus = ''; first = false; }
    form.appendChild(el);
  };

  // --- What the owner configured (read only) ---
  const provider = (c, off) => (NAMES[c.provider] ? `${NAMES[c.provider]}${c.model ? ` · ${c.model}` : c.voice ? ` · ${c.voice}` : ''}${String(c.key || '').trim() ? '' : ` (${t('ai.noKey')})`}` : t(off));
  section(t('ai.configured'));
  addRow(t('ai.llm'), () => provider(cfg.llm, 'ai.offline'), () => toast(t('ai.ownerNote')));
  addRow(t('ai.tts'), () => provider(cfg.tts, 'ai.deviceVoice'), () => toast(t('ai.ownerNote')));
  addRow(t('ai.stt'), () => provider(cfg.stt, 'ai.deviceMic'), () => toast(t('ai.ownerNote')));
  form.appendChild(h('p', { class: 'adm-note' }, t('ai.ownerNote')));

  // --- Switches ---
  section(t('ai.features'));
  const check = (label, prop) => addRow(label, () => (cfg[prop] !== false ? t('on') : t('off')), (refresh) => { cfg[prop] = cfg[prop] === false; refresh(); });
  check(t('ai.speaking'), 'speaking');
  check(t('ai.aiLessons'), 'aiLessons');

  // --- PC browser test ---
  section(t('ai.pcTest'));
  addRow(t('ai.corsProxy'), () => (cfg.corsProxy ? t('on') : t('off')), (refresh) => { cfg.corsProxy = !cfg.corsProxy; refresh(); });
  addRow(t('ai.corsProxyUrl'), () => cfg.corsProxyUrl, (refresh) => {
    const input = h('input', { class: 'adm-input', type: 'text', value: cfg.corsProxyUrl, autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
    const wrap = focusable(h('div', { class: 'adm-input-wrap' }, input), () => input.focus());
    openDialog({ title: t('ai.corsProxyUrl'), body: wrap, buttons: [{ label: t('cancel') }, { label: t('ai.ok'), kind: 'primary', onSelect: () => { if (input.value.trim()) { cfg.corsProxyUrl = input.value.trim(); refresh(); } } }] });
  });
  addRow(t('ai.unlockProxy'), () => '↗', () => { window.open(`${String(cfg.corsProxyUrl || '').replace(/\/*$/, '/')}corsdemo`, '_blank', 'noopener'); });
  form.appendChild(h('p', { class: 'adm-note' }, t('ai.corsNote')));

  function show(ok, message) {
    banner.hidden = false;
    banner.className = `adm-banner ${ok ? 'ok' : 'bad'}`;
    banner.textContent = message;
    if (app.MyPC && app.MyPC.announce) app.MyPC.announce(message);
  }

  let testing = false;
  const testBtn = focusable(h('button', { class: 'btn blue' }, t('ai.test')), async () => {
    if (testing) return;
    testing = true; testBtn.classList.add('disabled');
    show(true, t('ai.testing'));
    saveAiConfig(cfg);                                  // the client reads the saved switches (proxy)
    try { const r = await testConnection(); show(r.ok, r.message); } finally { testing = false; testBtn.classList.remove('disabled'); }
  });
  const saveBtn = focusable(h('button', { class: 'btn primary' }, t('ai.save')), () => { saveAiConfig(cfg); toast(t('ai.saved')); });
  const back = focusable(h('button', { class: 'btn' }, t('back')), () => app.go.home());

  return {
    el: h('div', { class: 'page adm-page' },
      h('div', { class: 'page-head' }, h('h1', null, t('ai.adminTitle')), back),
      banner, form,
      h('div', { class: 'adm-foot' }, testBtn, saveBtn)),
    onBack: () => app.go.home(),
  };
}

// Admin: the optional AI settings (language model, voices, switches). Keys are typed here and saved
// only through saveAiConfig (MyPC.save, this profile). Everything works with arrows + OK:
// choices cycle on OK, text fields open a dialog, because a TV remote cannot type inline.
import { h, focusable } from '../../platform/dom.js?v=2.4.0';
import { t } from '../../platform/i18n.js?v=2.4.0';
import { aiConfig, saveAiConfig, LLM_PRESETS, TTS_PRESETS, STT_PRESETS } from '../../ai/config.js?v=2.4.0';
import { testConnection } from '../../ai/client.js?v=2.4.0';
import { openDialog, toast } from '../components.js?v=2.4.0';

const TEMPS = [0, 0.2, 0.4, 0.7, 1];
const LLM_NAMES = { nvidia: 'NVIDIA NIM', gemini: 'Google Gemini', openai: 'OpenAI', offline: null };
const TTS_NAMES = { webspeech: null, openai: 'OpenAI', riva: 'NVIDIA Riva' };
const STT_NAMES = { webspeech: null, openai: 'OpenAI Whisper' };

export function adminScreen(app) {
  const cfg = aiConfig();
  const form = h('div', { class: 'adm-form' });
  const banner = h('div', { class: 'adm-banner', role: 'status', hidden: true });
  let first = true;

  const section = (title) => form.appendChild(h('h2', { class: 'adm-section' }, title));
  const addRow = (label, getValue, onSelect, extra) => {
    const v = h('b', { class: 'adm-value', dir: 'auto' }, getValue());
    const el = focusable(h('button', { class: 'adm-row' }, h('span', { class: 'adm-label' }, label), v), () => onSelect(() => { v.textContent = getValue(); }));
    if (first) { el.dataset.autofocus = ''; first = false; }
    form.appendChild(el);
    return { refresh: () => { v.textContent = getValue(); } };
  };

  // A choice that cycles on OK. names: { value: label | null (null = translated "offline/device" text) }.
  const choice = (label, obj, prop, names, offKey, onChange) => {
    const list = Object.keys(names);
    return addRow(label, () => names[obj[prop]] || t(offKey), (refresh) => {
      obj[prop] = list[(list.indexOf(obj[prop]) + 1) % list.length];
      if (onChange) onChange();
      refresh();
    });
  };

  // A text value edited in a dialog. secret fields show dots and use a password input.
  const text = (label, obj, prop, { secret = false, number = false } = {}) => {
    const show = () => {
      const v = obj[prop];
      if (!v) return t('ai.notSet');
      return secret ? '•'.repeat(Math.min(String(v).length, 12)) : String(v);
    };
    return addRow(label, show, (refresh) => {
      const input = h('input', { class: 'adm-input', type: secret ? 'password' : 'text', value: obj[prop] || '', autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
      const wrap = focusable(h('div', { class: 'adm-input-wrap' }, input), () => input.focus());
      openDialog({
        title: label, body: wrap,
        buttons: [{ label: t('cancel') }, { label: t('ai.ok'), kind: 'primary', onSelect: () => { obj[prop] = input.value.trim(); refresh(); } }],
      });
    });
  };

  const check = (label, obj, prop) => addRow(label, () => (obj[prop] !== false ? t('on') : t('off')), (refresh) => { obj[prop] = obj[prop] === false; refresh(); });

  // --- Language model ---
  section(t('ai.llm'));
  const llmRows = [];
  llmRows.push(choice(t('ai.provider'), cfg.llm, 'provider', LLM_NAMES, 'ai.offline', () => {
    const p = LLM_PRESETS[cfg.llm.provider];
    cfg.llm.endpoint = p.endpoint; cfg.llm.model = p.model;      // the preset is only a starting point, both stay editable
    llmRows.forEach((r) => r.refresh());
  }));
  llmRows.push(text(t('ai.endpoint'), cfg.llm, 'endpoint'));
  llmRows.push(text(t('ai.model'), cfg.llm, 'model'));
  llmRows.push(addRow(t('ai.temperature'), () => String(cfg.llm.temperature), (refresh) => {
    const i = TEMPS.indexOf(+cfg.llm.temperature);
    cfg.llm.temperature = TEMPS[(i + 1) % TEMPS.length]; refresh();
  }));
  llmRows.push(text(t('ai.key'), cfg.llm, 'key', { secret: true }));

  // --- Voice out ---
  section(t('ai.tts'));
  const ttsRows = [];
  ttsRows.push(choice(t('ai.provider'), cfg.tts, 'provider', TTS_NAMES, 'ai.deviceVoice', () => {
    const p = TTS_PRESETS[cfg.tts.provider];
    cfg.tts.endpoint = p.endpoint; cfg.tts.voice = p.voice;
    ttsRows.forEach((r) => r.refresh());
  }));
  ttsRows.push(text(t('ai.endpoint'), cfg.tts, 'endpoint'));
  ttsRows.push(text(t('ai.key'), cfg.tts, 'key', { secret: true }));
  ttsRows.push(text(t('ai.voice'), cfg.tts, 'voice'));
  form.appendChild(h('p', { class: 'adm-note' }, t('ai.rivaNote')));

  // --- Voice in ---
  section(t('ai.stt'));
  const sttRows = [];
  sttRows.push(choice(t('ai.provider'), cfg.stt, 'provider', STT_NAMES, 'ai.deviceMic', () => {
    cfg.stt.endpoint = STT_PRESETS[cfg.stt.provider].endpoint;
    sttRows.forEach((r) => r.refresh());
  }));
  sttRows.push(text(t('ai.endpoint'), cfg.stt, 'endpoint'));
  sttRows.push(text(t('ai.key'), cfg.stt, 'key', { secret: true }));

  // --- Switches ---
  section(t('ai.features'));
  check(t('ai.speaking'), cfg, 'speaking');
  check(t('ai.aiLessons'), cfg, 'aiLessons');
  form.appendChild(h('p', { class: 'adm-note' }, t('ai.privacy')));

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
    saveAiConfig(cfg);                                  // the client reads the saved settings
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

// AI settings: what My PC reports (service, model, voice, microphone) and the switches. The AI service and its keys live in
// My PC (Settings > AI on the TV); the owner can pick service and model in the App Store Manager (Config). Nothing secret here.
import { h, focusable } from '../../platform/dom.js?v=2.7.0';
import { t } from '../../platform/i18n.js?v=2.7.0';
import { aiConfig, saveAiConfig } from '../../ai/config.js?v=2.7.0';
import { testConnection } from '../../ai/client.js?v=2.7.0';
import { aiSupported, micSupported, providers, llmTarget, voiceName } from '../../ai/bridge.js?v=2.7.0';
import { toast } from '../components.js?v=2.7.0';

export function adminScreen(app) {
  const cfg = aiConfig();
  const form = h('div', { class: 'adm-form' });
  const banner = h('div', { class: 'adm-banner', role: 'status', hidden: true });
  let first = true;
  let list = null;                                      // MyPC.ai.providers(), loaded when the screen opens

  const section = (title) => form.appendChild(h('h2', { class: 'adm-section' }, title));
  const addRow = (label, getValue, onSelect) => {
    const v = h('b', { class: 'adm-value', dir: 'auto' }, getValue());
    const refresh = () => { v.textContent = getValue(); };
    const el = focusable(h('button', { class: 'adm-row' }, h('span', { class: 'adm-label' }, label), v), () => onSelect(refresh));
    if (first) { el.dataset.autofocus = ''; first = false; }
    form.appendChild(el);
    return refresh;
  };

  // --- What My PC reports (read only) ---
  const target = llmTarget();
  const pick = () => (list || []).find((p) => p.id === target.provider || p.type === target.provider || p.preset === target.provider) || (list || []).find((p) => p.isDefault) || (list || [])[0];
  const llmText = () => {
    if (!aiSupported()) return t('ai.errUnsupported');
    if (!list) return '…';
    const p = pick();
    return p ? `${p.name || p.id} · ${target.model || p.model || ''}` : t('ai.notSet');
  };
  const voiceText = () => {
    if (!aiSupported()) return t('ai.deviceVoice');
    if (!list) return '…';
    const nv = list.find((p) => p.type === 'nvidia' || p.preset === 'nvidia' || p.id === 'nvidia');
    return nv && (!nv.tasks || nv.tasks.speech) ? `NVIDIA Magpie · ${voiceName()}` : t('ai.deviceVoice');
  };
  const micText = () => {
    if (!micSupported()) return t('ai.deviceMic');
    if (!list) return '…';
    return list.some((p) => p.tasks && p.tasks.transcribe) ? t('on') : t('ai.noTranscribe');
  };
  section(t('ai.configured'));
  const note = () => toast(t('ai.ownerNote'));
  const refreshAll = [addRow(t('ai.llm'), llmText, note), addRow(t('ai.tts'), voiceText, note), addRow(t('ai.stt'), micText, note)];
  form.appendChild(h('p', { class: 'adm-note' }, t('ai.ownerNote')));
  providers(true).then((l) => { list = l; refreshAll.forEach((f) => f()); });

  // --- Switches ---
  section(t('ai.features'));
  const check = (label, prop) => addRow(label, () => (cfg[prop] !== false ? t('on') : t('off')), (refresh) => { cfg[prop] = cfg[prop] === false; refresh(); });
  check(t('ai.speaking'), 'speaking');
  check(t('ai.aiLessons'), 'aiLessons');

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

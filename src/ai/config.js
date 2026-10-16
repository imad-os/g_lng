// Optional AI settings. Saved only through MyPC.save (per profile); keys never leave this device except
// in the request to the provider the user chose. Nothing here is logged.
import { loadExtra, saveExtra } from '../data/progress-store.js?v=2.4.0';

// Provider presets: the endpoint and model shown when the user switches provider (both stay editable).
export const LLM_PRESETS = {
  nvidia: { endpoint: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct' },
  openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  offline: { endpoint: '', model: '' },
};
export const TTS_PRESETS = {
  webspeech: { endpoint: '', voice: '' },
  openai: { endpoint: 'https://api.openai.com/v1', voice: 'alloy' },
  riva: { endpoint: 'https://integrate.api.nvidia.com/v1', voice: '' },
};
export const STT_PRESETS = {
  webspeech: { endpoint: '' },
  openai: { endpoint: 'https://api.openai.com/v1' },
};

const defaults = () => ({
  enabled: true,
  llm: { provider: 'offline', ...LLM_PRESETS.nvidia, temperature: 0.4, key: '' },
  tts: { provider: 'webspeech', endpoint: '', key: '', voice: '' },
  stt: { provider: 'webspeech', endpoint: '', key: '' },
  speaking: true,
  aiLessons: true,
});

export function aiConfig() {
  let saved = {};
  try { saved = loadExtra('ai', {}) || {}; } catch (e) { saved = {}; }
  const d = defaults();
  return {
    ...d, ...saved,
    llm: { ...d.llm, ...(saved.llm || {}) },
    tts: { ...d.tts, ...(saved.tts || {}) },
    stt: { ...d.stt, ...(saved.stt || {}) },
  };
}

export function saveAiConfig(cfg) { saveExtra('ai', cfg); }

// AI lessons and explanations need a provider, a key and the switches on.
export function aiReady() {
  const c = aiConfig();
  return c.enabled !== false && c.aiLessons !== false && c.llm.provider !== 'offline' && !!String(c.llm.key || '').trim();
}

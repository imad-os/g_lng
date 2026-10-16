// Optional AI settings. Saved only through MyPC.save (per profile); keys never leave this device except
// in the request to the provider the user chose. Nothing here is logged.
import { loadExtra, saveExtra } from '../data/progress-store.js?v=2.5.1';

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
  // NVIDIA Magpie-Multilingual (NVCF function). voice = speaker name, for example Aria; the language is sent with every request.
  magpie: { endpoint: 'https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio/synthesize', voice: 'Aria' },
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
  // Only for testing in a PC browser: provider APIs often block browser calls (CORS). A TV needs none of this.
  corsProxy: false,
  corsProxyUrl: 'https://cors-anywhere.herokuapp.com/',
});

// Route a request through the CORS test proxy when the switch is on. Returns the new { url, headers }.
export function viaProxy(url, headers = {}) {
  const c = aiConfig();
  if (!c.corsProxy || !c.corsProxyUrl) return { url, headers };
  return { url: String(c.corsProxyUrl).replace(/\/*$/, '/') + url, headers: { ...headers, 'X-Requested-With': 'XMLHttpRequest' } };
}

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

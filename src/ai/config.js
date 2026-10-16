// Optional AI settings. Saved only through MyPC.save (per profile); keys never leave this device except
// in the request to the provider the user chose. Nothing here is logged.
import { loadExtra, saveExtra } from '../data/progress-store.js?v=2.5.7';

// Provider presets: the endpoint and model shown when the user switches provider (both stay editable).
export const LLM_PRESETS = {
  nvidia: { endpoint: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.1-8b-instruct' },
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

// Providers, models, addresses and keys come from MyPC.app_config (App Store Manager -> Config), never from the app's own
// screens. Only the switches below are saved per profile.
let appAi = {};
export function setAppAiConfig(raw) { appAi = raw && typeof raw === 'object' ? raw : {}; }

const str = (v) => (typeof v === 'string' ? v.trim() : '');
function fromApp(kind, presets, fallbackProvider) {
  const a = appAi[kind] && typeof appAi[kind] === 'object' ? appAi[kind] : {};
  const provider = presets[str(a.provider)] ? str(a.provider) : (str(a.key) ? fallbackProvider : presets.offline ? 'offline' : 'webspeech');
  const p = presets[provider] || {};
  return { ...p, provider, key: str(a.key), ...(str(a.endpoint) ? { endpoint: str(a.endpoint) } : {}), ...(str(a.model) ? { model: str(a.model) } : {}), ...(str(a.voice) ? { voice: str(a.voice) } : {}) };
}

const defaults = () => ({
  enabled: true,
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
  const llm = fromApp('llm', LLM_PRESETS, 'nvidia');
  const temp = Number((appAi.llm || {}).temperature);
  llm.temperature = Number.isFinite(temp) && (appAi.llm || {}).temperature !== '' ? Math.min(1, Math.max(0, temp)) : 0.4;
  return {
    enabled: saved.enabled !== false, speaking: saved.speaking !== false, aiLessons: saved.aiLessons !== false,
    corsProxy: saved.corsProxy === true, corsProxyUrl: str(saved.corsProxyUrl) || d.corsProxyUrl,
    llm,
    tts: fromApp('tts', TTS_PRESETS, 'openai'),
    stt: fromApp('stt', STT_PRESETS, 'openai'),
  };
}

// Only the switches are saved (never keys or addresses).
export function saveAiConfig(cfg) {
  saveExtra('ai', { enabled: cfg.enabled, speaking: cfg.speaking, aiLessons: cfg.aiLessons, corsProxy: cfg.corsProxy, corsProxyUrl: cfg.corsProxyUrl });
}

// AI lessons and explanations need a provider, a key and the switches on.
export function aiReady() {
  const c = aiConfig();
  return c.enabled !== false && c.aiLessons !== false && c.llm.provider !== 'offline' && !!String(c.llm.key || '').trim();
}

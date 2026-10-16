// Language model client: OpenAI-compatible chat (NVIDIA NIM, OpenAI) and Gemini generateContent.
// Error messages come from t('ai.err*') and never contain the key.
import { aiConfig, viaProxy } from './config.js?v=2.5.3';
import { setAiStatus } from './status.js?v=2.5.3';
import { t } from '../platform/i18n.js?v=2.5.3';

const TIMEOUT_MS = 30000;

function build(cfg, { system, user, json, messages }) {
  const turns = messages && messages.length ? messages : [{ role: 'user', content: user }];
  const { provider, model, temperature, key } = cfg.llm;
  const base = String(cfg.llm.endpoint || '').replace(/\/+$/, '');
  const temp = Number.isFinite(+temperature) ? +temperature : 0.4;
  if (provider === 'gemini') {
    return {
      url: `${base}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: {
        systemInstruction: { parts: [{ text: system || '' }] },
        contents: turns.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: temp, ...(json ? { responseMimeType: 'application/json' } : {}) },
      },
    };
  }
  return {
    url: `${base}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: {
      model, temperature: temp, max_tokens: 1500,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...turns],
      ...(json && provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
    },
  };
}

function extract(provider, data) {
  let text;
  if (provider === 'gemini') {
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts;
    text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
  } else {
    text = (((data.choices || [])[0] || {}).message || {}).content;
  }
  if (typeof text !== 'string' || !text.trim()) throw new Error(t('ai.errEmpty'));
  return text.trim();
}

// One request with its own timeout; an outer signal (user left the screen) aborts it too.
async function send(req, outer) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort('timeout'), TIMEOUT_MS);
  const onOuter = () => ctl.abort('cancel');
  if (outer) { if (outer.aborted) onOuter(); else outer.addEventListener('abort', onOuter, { once: true }); }
  try {
    const r = viaProxy(req.url, req.headers);
    return await fetch(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(req.body), signal: ctl.signal });
  } catch (e) {
    if (ctl.signal.reason === 'timeout') throw new Error(t('ai.errTimeout'));
    if (ctl.signal.aborted) throw new Error(t('ai.errCancelled'));
    throw new Error(t('ai.errNetwork'));
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener('abort', onOuter);
  }
}

// `messages` (optional) is the conversation so far: [{role: 'user' | 'assistant', content}]; otherwise `user` is the only turn.
export async function chat({ system, user, messages, json = false, signal } = {}) {
  const cfg = aiConfig();
  if (cfg.llm.provider === 'offline') throw new Error(t('ai.errOffline'));
  if (!String(cfg.llm.key || '').trim()) throw new Error(t('ai.errNoKey'));
  if (!cfg.llm.endpoint || !cfg.llm.model) throw new Error(t('ai.errNoEndpoint'));
  const req = build(cfg, { system, user, json, messages });
  setAiStatus({ kind: 'llm', busy: true, label: `${cfg.llm.model}` });
  try { return await run(cfg, req, signal); } finally { setAiStatus({ kind: 'llm', busy: false, label: `${cfg.llm.model}` }); }
}

async function run(cfg, req, signal) {
  let res = await send(req, signal);
  if (res.status === 429 || res.status >= 500) {          // one retry for busy servers
    await new Promise((r) => setTimeout(r, 1200));
    res = await send(req, signal);
  }
  if (res.status === 401 || res.status === 403) throw new Error(t('ai.errKey'));
  if (res.status === 404) throw new Error(t('ai.errModel'));
  if (res.status === 429) throw new Error(t('ai.errBusy'));
  if (!res.ok) throw new Error(t('ai.errServer', { n: res.status }));
  let data;
  try { data = await res.json(); } catch (e) { throw new Error(t('ai.errEmpty')); }
  return extract(cfg.llm.provider, data);
}

export async function testConnection() {
  const t0 = Date.now();
  try {
    await chat({ system: 'Reply with one word.', user: 'Say OK.' });
    return { ok: true, ms: Date.now() - t0, message: t('ai.testOk', { ms: Date.now() - t0 }) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, message: e.message };
  }
}

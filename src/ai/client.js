// Language model client: every call goes to MyPC.ai (see bridge.js). Error messages come from t('ai.err*').
import { generate, fail, lastTurns, llmTarget, aiSupported } from './bridge.js?v=2.7.1';
import { setAiStatus } from './status.js?v=2.7.1';
import { t } from '../platform/i18n.js?v=2.7.1';

const START = 'Start the conversation with a greeting and one easy question.';
// `messages` (optional) is the conversation so far: [{role: 'user' | 'assistant', content}]; otherwise `user` is the only turn.
// json: ask for a JSON answer (with `schema` when given) and get it back as text. onDelta: the answer piece by piece.
export async function chat({ system, user, messages, json = false, schema, signal, onDelta, maxTokens = 700 } = {}) {
  if (!aiSupported()) throw new Error(t('ai.errUnsupported'));
  const turns = lastTurns(messages && messages.length ? messages : [{ role: 'user', content: user }]);
  const last = turns[turns.length - 1];
  const earlier = turns.slice(0, -1);
  if (earlier.length && earlier[0].role !== 'user') earlier.unshift({ role: 'user', content: START });
  const { provider, model } = llmTarget();
  const req = {
    ...(provider ? { provider } : {}), ...(model ? { model } : {}), system: system || undefined,
    ...(earlier.length ? { messages: earlier } : {}), prompt: last.content,
    output: json ? 'json' : 'text', ...(json && schema ? { schema } : {}),
    temperature: 0.4, maxTokens,
  };
  let label = [provider, model].filter(Boolean).join(' · ') || 'AI';
  setAiStatus({ kind: 'llm', busy: true, label });
  try {
    let res;
    try { res = await generate(req, { signal, onDelta }); } catch (e) {
      if (json && e && e.code === 'http' && e.status === 400) {      // the model has no JSON mode: ask for JSON in words only
        res = await generate({ ...req, output: 'text', schema: undefined }, { signal, onDelta });
      } else throw e;
    }
    if (res && (res.provider || res.model)) label = [res.provider, res.model].filter(Boolean).join(' · ');   // what My PC really used
    const text = json && res && res.json !== undefined ? JSON.stringify(res.json) : String((res && res.text) || '').trim();
    if (!text) throw new Error(t('ai.errEmpty'));
    return text;
  } catch (e) {
    if (e && e.code) throw fail(e);
    throw e;
  } finally { setAiStatus({ kind: 'llm', busy: false, label }); }
}

export async function testConnection() {
  const t0 = Date.now();
  try {
    await chat({ system: 'Reply with one word.', user: 'Say OK.', maxTokens: 20 });
    return { ok: true, ms: Date.now() - t0, message: t('ai.testOk', { ms: Date.now() - t0 }) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, message: e.message };
  }
}

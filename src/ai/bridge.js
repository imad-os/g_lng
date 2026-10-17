// The only door to AI, the voice and the microphone: My PC (MyPC.ai, MyPC.mic, guide section 14). The keys stay on the TV;
// the app never sees them, never calls a provider itself and has no proxy. Errors become short texts of t('ai.err*').
import { t } from '../platform/i18n.js?v=2.7.0';

export const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';
const MAX_TURNS = 10;

let MP = null;
let appAi = {};
let providerList = null;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// appConfig is MyPC.app_config: { ai: { provider, model, voice } } (all optional).
export function setBridge(MyPC, appConfig) {
  MP = MyPC || null;
  const a = appConfig && appConfig.ai;
  appAi = a && typeof a === 'object' ? a : {};
  providerList = null;
}

export const aiSupported = () => !!(MP && MP.ai && typeof MP.ai.generate === 'function' && Number(MP.apiLevel) >= 10);

export function micSupported() {
  if (!aiSupported() || !MP.mic || typeof MP.mic.record !== 'function') return false;
  try { const b = MP.info && MP.info().bridges; if (b && b.mic === 0) return false; } catch (e) { /* no info */ }
  return true;
}

// Language model target: the app config picks the service and model, otherwise NVIDIA and the guide's model.
export function llmTarget() {
  const provider = str(appAi.provider) || 'nvidia';
  const model = str(appAi.model) || (provider === 'nvidia' ? DEFAULT_MODEL : '');
  return { provider, model };
}
export const voiceName = () => str(appAi.voice) || 'Aria';

// What the TV says it has (no keys): [{ id, name, type, model, isDefault, tasks }]. Never throws.
export async function providers(force = false) {
  if (!aiSupported() || typeof MP.ai.providers !== 'function') return [];
  if (providerList && !force) return providerList;
  try { const l = await MP.ai.providers(); providerList = Array.isArray(l) ? l : []; } catch (e) { providerList = []; }
  return providerList;
}
export const knownProviders = () => providerList;

export function explain(e, kind) {
  const code = e && e.code;
  const st = e && e.status;
  const more = e && e.message && !/^(http|network)$/.test(e.message) ? ` [${String(e.message).replace(/\s+/g, ' ').slice(0, 120)}]` : '';
  switch (code) {
    case 'no-provider': return t('ai.errNoProvider');
    case 'denied': return kind === 'mic' ? t('ai.errMicDenied') : t('ai.errDenied');
    case 'unsupported': return aiSupported() ? t('ai.errNotHere') : t('ai.errUnsupported');
    case 'no-mic': return t('ai.errNoMic');
    case 'cancelled': return t('ai.errCancelled');
    case 'timeout': return t('ai.errTimeout');
    case 'network': case 'blocked': return t('ai.errNetwork');
    case 'busy': return t('ai.errBusy');
    case 'safety': case 'too-big': return t('ai.errEmpty');
    case 'http':
      if (st === 401 || st === 403) return t('ai.errKey');
      if (st === 404) return t('ai.errModel') + more;
      if (st === 410) return t('ai.errGone') + more;
      if (st === 429) return t('ai.errBusy');
      return t('ai.errServer', { n: st || '?' }) + more;
    default: return (e && e.message && e.message.length < 140 ? e.message : t('ai.errNetwork'));
  }
}

export const fail = (e, kind) => Object.assign(new Error(explain(e, kind)), { code: e && e.code, status: e && e.status });
// These codes will not fix themselves in this session: callers stop asking.
export const hopeless = (e) => !!e && (e.code === 'no-provider' || e.code === 'denied' || e.code === 'unsupported');

// One MyPC.ai.generate call; `signal` (AbortSignal) cancels it. One retry when the service is busy.
export async function generate(req, { signal, onDelta } = {}) {
  if (!aiSupported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
  const once = () => {
    if (signal && signal.aborted) return Promise.reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }));
    const job = MP.ai.generate(req, onDelta ? { onDelta } : undefined);
    const stop = () => { try { if (job && job.cancel) job.cancel(); } catch (e) { /* already done */ } };
    if (signal) signal.addEventListener('abort', stop, { once: true });
    return Promise.resolve(job).finally(() => { if (signal) signal.removeEventListener('abort', stop); });
  };
  try { return await once(); } catch (e) {
    if (e && (e.code === 'busy' || (e.code === 'http' && (e.status === 429 || e.status >= 500)))) {
      await new Promise((r) => setTimeout(r, 1200));
      return once();
    }
    throw e;
  }
}

export const lastTurns = (messages) => (messages || []).slice(-MAX_TURNS);

// Speech to text: record from the microphone (My PC asks the user once), then transcribe with a service that can.
let micJob = null;
export function cancelRecording() { if (micJob) { micJob = null; try { MP.mic.cancel(); } catch (e) { /* not recording */ } } }

export async function recordAndTranscribe(language, { maxSeconds = 6 } = {}) {
  if (!micSupported()) throw Object.assign(new Error('no-mic'), { code: 'no-mic' });
  const list = await providers();
  const stt = list.filter((p) => p.tasks && p.tasks.transcribe);
  if (list.length && !stt.length) throw Object.assign(new Error('no transcribe'), { code: 'no-provider' });
  const pick = stt.find((p) => p.isDefault) || stt[0];
  const token = {};
  micJob = token;
  let rec;
  try { rec = await MP.mic.record({ maxSeconds, silence: { ms: 1200, threshold: 0.02 } }); } finally { if (micJob === token) micJob = null; }
  if (!rec || !rec.audio || (rec.seconds !== undefined && rec.seconds < 0.3)) return '';
  const res = await generate({ ...(pick ? { provider: pick.id } : {}), task: 'transcribe', language: String(language || '').slice(0, 2).toLowerCase() || undefined, prompt: [{ type: 'audio', data: rec.audio, mime: rec.mime }] });
  return String((res && res.text) || '').trim();
}

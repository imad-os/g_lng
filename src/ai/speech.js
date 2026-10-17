// Optional external voice: NVIDIA Magpie text-to-speech and speech to text, both through My PC (bridge.js).
// Every failure is quiet (false / '') so the caller can fall back to the device voice; keys never reach the app.
import { aiConfig } from './config.js?v=2.7.0';
import { aiSupported, micSupported, generate, explain, hopeless, voiceName, recordAndTranscribe, cancelRecording, knownProviders } from './bridge.js?v=2.7.0';
import { setAiStatus } from './status.js?v=2.7.0';
import { playVoiceBytes } from '../platform/audio.js?v=2.7.0';
import { t } from '../platform/i18n.js?v=2.7.0';

const baseLang = (code) => String(code || '').slice(0, 2).toLowerCase();
// Magpie-Multilingual speaks these (language -> locale code My PC wants). Arabic and Tamazight use the device voice.
const MAGPIE = { en: 'en-US', es: 'es-US', fr: 'fr-FR', de: 'de-DE' };
const LABEL = 'NVIDIA Magpie';

// ---- Text to speech ------------------------------------------------------------------------

let audioEl = null;
let audioUrl = null;
let finish = null;          // resolves the pending externalSpeak when playback is stopped
let ttsCtl = null;
let ttsOff = false;         // My PC said no service / not allowed / too old: stop asking in this session

export function externalTtsEnabled() {
  const c = aiConfig();
  return c.enabled !== false && !ttsOff && aiSupported();
}

export function stopExternalSpeech() {
  if (ttsCtl) { ttsCtl.stopped = true; ttsCtl.abort(); ttsCtl = null; setAiStatus({ kind: 'voice', busy: false }); }
  if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); audioEl = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  if (finish) { const f = finish; finish = null; f(true); }   // stopped on purpose: no device-voice fallback
}

export async function externalSpeak(text, langCode, slow = false) {
  stopExternalSpeech();
  const loc = MAGPIE[baseLang(langCode)];
  if (!externalTtsEnabled() || !text || !loc) return false;
  const voice = voiceName();
  const ctl = new AbortController();
  ttsCtl = ctl;
  const label = `${LABEL} · ${voice}`;
  let loading = true;
  const fail = (why) => setAiStatus({ kind: 'voice', busy: false, label: LABEL, error: why });      // shown in the badge: the owner can see what went wrong
  const loaded = () => { if (loading && ttsCtl === ctl) { loading = false; setAiStatus({ kind: 'voice', busy: false, label }); } };
  const timer = setTimeout(() => ctl.abort(), 25000);
  setAiStatus({ kind: 'voice', busy: true, error: '', label });
  try {
    const res = await generate({ provider: 'nvidia', task: 'speech', model: 'magpie-multilingual', prompt: text, voice, language: loc }, { signal: ctl.signal });
    const part = ((res && res.parts) || []).find((p) => p && p.type === 'audio' && p.data);
    loaded();
    if (ttsCtl !== ctl) return true;                    // another call or stop took over meanwhile
    if (!part || !(part.data.byteLength || part.data.length)) { fail('empty audio'); return false; }
    const bytes = part.data instanceof ArrayBuffer ? part.data : new Uint8Array(part.data).buffer;
    try {
      const played = await playVoiceBytes(bytes.slice(0), slow);
      if (played) return true;
    } catch (e) { /* decode failed: try the audio element below */ }
    audioUrl = URL.createObjectURL(new Blob([bytes], { type: part.mime || 'audio/wav' }));
    const el = new Audio(audioUrl);
    audioEl = el;
    const ok = await new Promise((resolve) => {
      finish = resolve;
      el.onended = () => { finish = null; resolve(true); };
      el.onerror = () => { finish = null; resolve(false); };
      el.play().catch(() => { finish = null; resolve(false); });
    }).finally(() => { if (audioEl === el) stopExternalSpeech(); });
    if (!ok) fail('cannot play the audio here');
    return ok;
  } catch (e) {
    if (ctl.stopped) return true;                       // stopped on purpose is not a failure
    if (hopeless(e)) ttsOff = true;
    fail(e && e.code ? explain(e) : 'request failed');
    return false;
  } finally {
    loaded();
    clearTimeout(timer);
    if (ttsCtl === ctl) ttsCtl = null;
  }
}

// ---- Speech to text ------------------------------------------------------------------------

let sttOff = false;

export function sttAvailable() {
  const c = aiConfig();
  if (c.enabled === false || c.speaking === false || sttOff || !micSupported()) return false;
  const list = knownProviders();                        // known after the AI settings were opened or a mic try
  return !(list && list.length && !list.some((p) => p.tasks && p.tasks.transcribe));
}

export function abortListening() { cancelRecording(); }

export async function listenOnce(langCode, { timeoutMs = 6000 } = {}) {
  abortListening();
  try {
    return await recordAndTranscribe(langCode, { maxSeconds: Math.ceil(timeoutMs / 1000) });
  } catch (e) {
    if (e && e.code === 'cancelled') return '';
    if (hopeless(e) || (e && e.code === 'no-mic')) sttOff = e.code !== 'denied';
    throw Object.assign(new Error(e && e.code ? explain(e, 'mic') : t('ai.errNoMic')), { code: e && e.code });
  }
}

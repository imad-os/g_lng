// Optional external voices: text-to-speech from a provider, speech-to-text from the browser or a provider.
// Every failure is quiet (false / '') so the caller can fall back to the device voice; keys are never logged.
import { aiConfig } from './config.js?v=2.4.0';
import { t } from '../platform/i18n.js?v=2.4.0';

const NO_EXTERNAL = new Set(['', 'zgh', 'tzm', 'ber']);   // Tamazight has no provider voice: device voice instead
const baseLang = (code) => String(code || '').slice(0, 2).toLowerCase();
const trim = (u) => String(u || '').replace(/\/+$/, '');

// ---- Text to speech ------------------------------------------------------------------------

let audioEl = null;
let audioUrl = null;
let finish = null;          // resolves the pending externalSpeak when playback is stopped
let ttsCtl = null;

export function externalTtsEnabled() {
  const c = aiConfig();
  return c.enabled !== false && c.tts.provider !== 'webspeech' && !!c.tts.endpoint && !!String(c.tts.key || '').trim();
}

export function stopExternalSpeech() {
  if (ttsCtl) { ttsCtl.stopped = true; ttsCtl.abort(); ttsCtl = null; }
  if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); audioEl = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  if (finish) { const f = finish; finish = null; f(true); }   // stopped on purpose: no device-voice fallback
}

export async function externalSpeak(text, langCode) {
  stopExternalSpeech();
  if (!externalTtsEnabled() || !text || NO_EXTERNAL.has(baseLang(langCode))) return false;
  const c = aiConfig().tts;
  const ctl = new AbortController();
  ttsCtl = ctl;
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const body = c.provider === 'openai'
      ? { model: 'tts-1', input: text, voice: c.voice || 'alloy', response_format: 'mp3' }
      : { input: text, voice: c.voice || undefined, language_code: langCode, response_format: 'wav' };   // Riva-style, same route shape
    const res = await fetch(`${trim(c.endpoint)}/audio/speech`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (ttsCtl !== ctl) return true;                    // another call or stop took over meanwhile
    if (!blob.size) return false;
    audioUrl = URL.createObjectURL(blob);
    const el = new Audio(audioUrl);
    audioEl = el;
    return await new Promise((resolve) => {
      finish = resolve;
      el.onended = () => { finish = null; resolve(true); };
      el.onerror = () => { finish = null; resolve(false); };
      el.play().catch(() => { finish = null; resolve(false); });
    }).finally(() => { if (audioEl === el) stopExternalSpeech(); });
  } catch (e) {
    return !!ctl.stopped;                               // stopped on purpose is not a failure
  } finally {
    clearTimeout(timer);
    if (ttsCtl === ctl) ttsCtl = null;
  }
}

// ---- Speech to text ------------------------------------------------------------------------

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
let abortFn = null;

export function sttAvailable() {
  const c = aiConfig();
  if (c.enabled === false || c.speaking === false) return false;
  if (c.stt.provider === 'openai') return !!(navigator.mediaDevices && window.MediaRecorder && c.stt.endpoint && String(c.stt.key || '').trim());
  return !!Recognition();
}

export function abortListening() { if (abortFn) { const f = abortFn; abortFn = null; f(); } }

export async function listenOnce(langCode, { timeoutMs = 6000 } = {}) {
  abortListening();
  const c = aiConfig().stt;
  return c.provider === 'openai' ? recordAndTranscribe(c, langCode, timeoutMs) : webSpeech(langCode, timeoutMs);
}

function webSpeech(langCode, timeoutMs) {
  return new Promise((resolve, reject) => {
    const R = Recognition();
    if (!R) { reject(new Error(t('ai.errNoMic'))); return; }
    const rec = new R();
    rec.lang = langCode || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = '', failure = null;
    const timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* already stopped */ } }, timeoutMs);
    rec.onresult = (ev) => { text = Array.from(ev.results).map((r) => r[0].transcript).join(' ').trim(); };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') failure = new Error(t('ai.errMicDenied')); };
    rec.onend = () => { clearTimeout(timer); abortFn = null; if (failure) reject(failure); else resolve(text); };
    abortFn = () => { clearTimeout(timer); try { rec.abort(); } catch (e) { /* ignore */ } };
    try { rec.start(); } catch (e) { clearTimeout(timer); abortFn = null; reject(new Error(t('ai.errNoMic'))); }
  });
}

async function recordAndTranscribe(c, langCode, timeoutMs) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { throw new Error(t('ai.errMicDenied')); }
  const stopTracks = () => stream.getTracks().forEach((tr) => tr.stop());
  let blob;
  try {
    const rec = new MediaRecorder(stream);
    const chunks = [];
    blob = await new Promise((resolve, reject) => {
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = () => reject(new Error(t('ai.errNoMic')));
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, timeoutMs);
      abortFn = () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); chunks.length = 0; };
      rec.start();
    });
  } finally { abortFn = null; stopTracks(); }
  if (blob.size < 1200) return '';                        // silence
  const form = new FormData();
  form.append('file', blob, 'speech.webm');
  form.append('model', 'whisper-1');
  if (baseLang(langCode)) form.append('language', baseLang(langCode));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${trim(c.endpoint)}/audio/transcriptions`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${c.key}` }, signal: ctl.signal });
    if (!res.ok) throw new Error(t('ai.errServer', { n: res.status }));
    const data = await res.json();
    return typeof data.text === 'string' ? data.text.trim() : '';
  } catch (e) {
    throw new Error(e.message && e.message.length < 120 && !/fetch|abort/i.test(e.message) ? e.message : t('ai.errNetwork'));
  } finally { clearTimeout(timer); }
}

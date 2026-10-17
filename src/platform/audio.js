// Sound: one AudioContext (created in onStart, closed in onDestroy) for effects and voice clips,
// with the device's speech voice as a fallback when no clip exists.

let ctx = null;
let gain = null;
let volume = { music: 0.7, sfx: 0.8 };
let audioBase = '';
let speechOn = true;
let sfxOn = true;
let externalStop = null;
let externalSpeak = null;         // optional hook: (text, lang, slow) -> Promise<boolean> (AI voice), set by main.js
const clips = new Map();           // audio key -> AudioBuffer | null (null = no clip)
const MAX_CLIPS = 60;
let playing = null;

export function configureAudio({ base, speech, vol, sfx }) {
  audioBase = base || '';
  speechOn = speech !== false;
  if (sfx !== undefined) sfxOn = sfx !== false;
  if (vol) setVolume(vol);
}

export function startAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = volume.sfx;
  } catch (e) { ctx = null; }
}

export function pauseAudio() {
  stopVoice();
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function setSfx(on) { sfxOn = !!on; }
export function setExternalSpeech(speakFn, stopFn) { externalSpeak = speakFn; externalStop = stopFn || null; }

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

export function destroyAudio() {
  stopVoice();
  clips.clear();
  if (ctx) { ctx.close(); ctx = null; gain = null; }
}

export function setVolume(v) {
  volume = { music: +v.music || 0, sfx: +v.sfx || 0 };
  if (gain) gain.gain.value = volume.sfx;
}

// Can this course be heard at all? (listen exercises turn into reading ones when not)
export function canSpeak(ttsLang) {
  if (audioBase) return true;
  return speechOn && !!findVoice(ttsLang);
}

function findVoice(ttsLang) {
  if (!ttsLang || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const base = ttsLang.slice(0, 2).toLowerCase();
  return voices.find((v) => v.lang === ttsLang) || voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
}

// Load the clips of a lesson ahead of time (only when a clip base is configured).
export function preload(keys) {
  if (!audioBase || !ctx) return;
  for (const k of keys) if (k && !clips.has(k)) loadClip(k);
}

function loadClip(key) {
  if (clips.size > MAX_CLIPS) clips.delete(clips.keys().next().value);
  const p = fetch(`${audioBase}/${key}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((buf) => new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej)))
    .then((b) => { clips.set(key, b); return b; }, () => { clips.set(key, null); return null; });
  clips.set(key, p);
  return p;
}

// Say a word or sentence: its clip when there is one, otherwise the device voice.
export async function say(item, ttsLang, slow = false) {
  stopVoice();
  if (!item) return;
  if (externalSpeak && await externalSpeak(item.t, ttsLang, slow).catch(() => false)) return;
  if (audioBase && ctx) {
    let b = clips.has(item.a) ? clips.get(item.a) : loadClip(item.a);
    if (b && typeof b.then === 'function') b = await b;
    if (b) {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = slow ? 0.65 : 1;
      src.connect(gain);
      src.start();
      playing = src;
      return;
    }
  }
  const voice = speechOn && findVoice(ttsLang);
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(item.t);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = slow ? 0.5 : 0.9;
  u.volume = volume.sfx;
  window.speechSynthesis.speak(u);
}

// Plays downloaded voice bytes (wav/mp3) through the app's AudioContext, like the clips. An <audio> element would need a
// user gesture, which the My PC iframe never gets from the TV remote. Returns true when it ended, null when there is no
// AudioContext, and throws when the bytes cannot be decoded.
export async function playVoiceBytes(bytes, slow = false) {
  if (!ctx) return null;
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* stays suspended */ } }
  const buf = await new Promise((res, rej) => ctx.decodeAudioData(bytes, res, rej));
  if (playing) { try { playing.stop(); } catch (e) { /* already ended */ } }
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = slow ? 0.65 : 1;
    src.connect(gain);
    src.onended = () => { if (playing === src) playing = null; resolve(true); };
    playing = src;
    src.start();
  });
}

export function stopVoice() {
  if (externalStop) externalStop();
  if (playing) { try { playing.stop(); } catch (e) { /* already ended */ } playing = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Short synthesized effects (no files to download). Each effect is a list of notes layered with soft envelopes.
//   [startSeconds, frequency, length, wave, loudness]
const EFFECTS = {
  tap: [[0, 520, 0.06, 'triangle', 0.12]],
  pick: [[0, 440, 0.07, 'sine', 0.14], [0.05, 660, 0.08, 'sine', 0.1]],
  right: [[0, 659, 0.14, 'triangle', 0.22], [0.09, 880, 0.14, 'triangle', 0.22], [0.18, 1319, 0.3, 'sine', 0.2], [0.18, 659, 0.3, 'sine', 0.08]],
  wrong: [[0, 233, 0.2, 'sawtooth', 0.09], [0.12, 175, 0.32, 'sawtooth', 0.1], [0.12, 117, 0.32, 'square', 0.05]],
  heart: [[0, 392, 0.12, 'triangle', 0.16], [0.1, 294, 0.12, 'triangle', 0.16], [0.2, 196, 0.3, 'triangle', 0.16]],
  gem: [[0, 1568, 0.1, 'sine', 0.15], [0.07, 2093, 0.1, 'sine', 0.14], [0.14, 2637, 0.25, 'sine', 0.12]],
  quest: [[0, 523, 0.12, 'triangle', 0.2], [0.1, 659, 0.12, 'triangle', 0.2], [0.2, 784, 0.12, 'triangle', 0.2], [0.3, 1047, 0.12, 'triangle', 0.2], [0.4, 1319, 0.5, 'sine', 0.22], [0.4, 784, 0.5, 'sine', 0.1]],
  done: [[0, 523, 0.14, 'triangle', 0.22], [0.12, 659, 0.14, 'triangle', 0.22], [0.24, 784, 0.14, 'triangle', 0.22], [0.36, 1047, 0.5, 'sine', 0.24], [0.36, 523, 0.5, 'sine', 0.1], [0.36, 784, 0.5, 'sine', 0.1]],
  fail: [[0, 392, 0.2, 'triangle', 0.16], [0.18, 330, 0.2, 'triangle', 0.16], [0.36, 262, 0.2, 'triangle', 0.16], [0.54, 196, 0.5, 'triangle', 0.16]],
  tick: [[0, 1000, 0.04, 'square', 0.05]],
  swoosh: [[0, 300, 0.08, 'sine', 0.1], [0.04, 450, 0.08, 'sine', 0.1], [0.08, 700, 0.1, 'sine', 0.08]],
};

// combo (2, 3, 4, ...) raises the pitch of the right-answer chime a little each time.
export function sfx(kind, combo = 0) {
  if (!sfxOn || !ctx || ctx.state !== 'running') return;
  const notes = EFFECTS[kind];
  if (!notes) return;
  const lift = kind === 'right' ? Math.pow(2, Math.min(combo, 8) / 12) : 1;
  const t0 = ctx.currentTime + 0.01;
  for (const [at, f, len, wave, vol] of notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.value = f * lift;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    o.connect(g); g.connect(gain);
    o.start(t0 + at); o.stop(t0 + at + len + 0.02);
  }
}

// Sound: one AudioContext (created in onStart, closed in onDestroy) for effects and voice clips,
// with the device's speech voice as a fallback when no clip exists.

let ctx = null;
let gain = null;
let volume = { music: 0.7, sfx: 0.8 };
let audioBase = '';
let speechOn = true;
const clips = new Map();           // audio key -> AudioBuffer | null (null = no clip)
const MAX_CLIPS = 60;
let playing = null;

export function configureAudio({ base, speech, vol }) {
  audioBase = base || '';
  speechOn = speech !== false;
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
  for (const k of keys) if (!clips.has(k)) loadClip(k);
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
export async function say(item, ttsLang) {
  stopVoice();
  if (!item) return;
  if (audioBase && ctx) {
    let b = clips.has(item.a) ? clips.get(item.a) : loadClip(item.a);
    if (b && typeof b.then === 'function') b = await b;
    if (b) {
      const src = ctx.createBufferSource();
      src.buffer = b;
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
  u.rate = 0.9;
  u.volume = volume.sfx;
  window.speechSynthesis.speak(u);
}

export function stopVoice() {
  if (playing) { try { playing.stop(); } catch (e) { /* already ended */ } playing = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Short synthesized effects (no files to download).
export function sfx(kind) {
  if (!ctx || ctx.state !== 'running') return;
  const notes = { right: [660, 880], wrong: [220, 180], done: [523, 659, 784, 1047] }[kind];
  if (!notes) return;
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'wrong' ? 'square' : 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
    g.gain.exponentialRampToValueAtTime(kind === 'wrong' ? 0.08 : 0.25, t0 + i * 0.09 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.18);
    o.connect(g); g.connect(gain);
    o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.2);
  });
}

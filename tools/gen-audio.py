#!/usr/bin/env python3
"""Pre-generate the voice clips (audio/<lang>/<hash>.mp3) for every word and sentence in content/build.

Free and offline: eSpeak NG (pip install espeakng-loader) + ffmpeg. The clip name is the item's `a` key from the
content build (language + hash of the text), so identical texts share one file. Existing clips are kept.
Usage: python3 tools/gen-audio.py [--prune] [lang ...]   (--prune also deletes clips no lesson uses any more)
"""
import ctypes, glob, json, os, subprocess, sys
import espeakng_loader

VOICES = {'en': 'en-us', 'fr': 'fr-fr', 'es': 'es', 'ar': 'ar', 'de': 'de'}   # Amazigh has no voice: device speech / silence
lib = ctypes.CDLL(espeakng_loader.get_library_path())
rate = lib.espeak_Initialize(2, 0, espeakng_loader.get_data_path().encode(), 0)
buf = bytearray()
CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
def on_samples(wav, n, ev):
    if wav and n > 0: buf.extend(ctypes.string_at(wav, n * 2))
    return 0
cb = CB(on_samples)
lib.espeak_SetSynthCallback(cb)
lib.espeak_SetParameter(1, 135, 0)    # speed in words per minute (a bit slower than the default 175, easier for learners)

def synth(text, voice):
    buf.clear()
    lib.espeak_SetVoiceByName(voice.encode())
    data = text.encode('utf-8') + b'\0'
    lib.espeak_Synth(data, len(data), 0, 0, 0, 1, None, None)   # flags 1 = UTF-8 text
    lib.espeak_Synchronize()
    return bytes(buf)

def encode(pcm, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', '-',
                    '-af', 'loudnorm=I=-18:TP=-2,silenceremove=1:0:-50dB', '-codec:a', 'libmp3lame', '-b:a', '24k', '-ar', '22050', out],
                   input=pcm, check=True)

prune = '--prune' in sys.argv
langs = [a for a in sys.argv[1:] if a != '--prune'] or list(VOICES)
todo = {}
for f in glob.glob('content/build/courses/*/lessons/*.json'):
    try: d = json.load(open(f))
    except Exception: continue
    for v in (d.get('vocab') or {}).values() if isinstance(d, dict) else []:
        a = v.get('a') if isinstance(v, dict) else None
        if a and a.split('/')[0] in langs and a.split('/')[0] in VOICES: todo[a] = v['t']
print(len(todo), 'clips wanted')
done = 0
for a, text in sorted(todo.items()):
    out = f'audio/{a}.mp3'
    if os.path.exists(out): continue
    pcm = synth(text, VOICES[a.split('/')[0]])
    if len(pcm) < 400: print('empty', a, text); continue
    encode(pcm, out)
    done += 1
    if done % 500 == 0: print(done, flush=True)
print('written', done)
if prune:
    keep = {f'audio/{a}.mp3' for a in todo}
    gone = 0
    for l in langs:
        for f in glob.glob(f'audio/{l}/*.mp3'):
            if f not in keep: os.remove(f); gone += 1
    print('pruned', gone)

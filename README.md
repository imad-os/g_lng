# Dualinguage

A language-learning app for **My PC** (Samsung TVs, browsers and phones). Short lessons, Duolingo-style
progression, nine levels from B1 (Beginner 1) to A3 (Advanced 3), played entirely with the TV remote.

- **Courses:** English, French, Spanish, Arabic (all levels); Amazigh and German (beginner levels).
- **Content:** read-only from Firestore. The app never writes lessons.
- **Progress:** saved with `MyPC.save`, per My PC profile. Nothing about the learner goes to Firestore.
- **No build step:** plain ES modules for Chrome 108 (Tizen 8).

## How it is organised

```
index.html, mypc-app.json, icon.svg      the My PC app shell and manifest
src/main.js                              MyPC.init lifecycle and navigation
src/platform/                            screen scaling, focus/input, audio, interface texts
src/data/                                Firestore reader, static fallback, content cache, MyPC.save progress
src/learning/                            lesson engine, spaced repetition, unlocks, rewards, review, learner summary
src/ui/                                  screens and the 8 exercise types
src/i18n/                                interface texts (en, fr, es, ar)
content/src/                             lesson source files (words and sentences with translations)
content/build/                           generated Firestore documents, one JSON file per document
tools/                                   build, validate, seed and check scripts (Node 18+, no dependencies)
firestore.rules                          public read, no client writes
```

Each file in `content/build` is one Firestore document at the same path, for example
`content/build/courses/fr/lessons/b1-u01-l1.json` is `courses/fr/lessons/b1-u01-l1`.

## Content workflow

```
npm run check          # build content, validate it, test the Firestore format, check the app against the My PC rules
npm run seed -- --key path/to/service-account.json     # write content/build to Firestore
```

1. Edit or add files in `content/src/<level>/<unit>.json`.
2. `npm run check` rebuilds `content/build` and stops on any problem.
3. `npm run seed -- --key …` writes the documents; the catalog is written last, so TVs switch to the new content only when it is complete.

## One-time Firebase setup

1. Firebase console → **Firestore Database** → create the database (production mode).
2. **Rules** tab → paste `firestore.rules` → **Publish**.
3. **Project settings → Service accounts → Generate new private key**. Keep the file on your PC, outside the repository.
4. `npm run seed -- --key C:\path\to\that-file.json`

Until Firestore is seeded, the app reads the same content from `content/build` on GitHub Pages, so it works either way.

## App config (App Store Manager → Config)

| Key | Default | Meaning |
| --- | --- | --- |
| `contentSource` | `"auto"` | `auto` tries Firestore then the static copy; `firestore` or `static` force one |
| `audioBase` | `"audio"` | folder of pre-generated voice clips (`audio/<lang>/<hash>.mp3`, made by `python3 tools/gen-audio.py`); a missing clip falls back to the device voice |
| `speech` | `true` | allow the device voice |
| `llm` | none | language model for chat practice, AI lessons and explanations: `{ "provider": "nvidia" \| "openai" \| "gemini", "endpoint": "", "model": "", "key": "", "temperature": 0.4 }`. Empty `endpoint`/`model` use the provider's default. No `key` = AI off |
| `tts` | device voice | voice that speaks to the learner: `{ "provider": "magpie" \| "openai" \| "riva", "endpoint": "", "voice": "Aria", "key": "" }`. Magpie speaks en/es/fr/de (the app sends the language with each request); other languages use the clips or the device voice |
| `stt` | device mic | microphone for speaking exercises and chat: `{ "provider": "webspeech" \| "openai", "endpoint": "", "key": "" }` |

| `corsProxy` | off | `{ "enabled": true, "url": "https://<your-worker>.workers.dev/" }`: sends the AI calls through your own CORS proxy (see below). Needed because My PC opens the app in a browser frame, and AI providers do not allow browser calls |

Example (App Store Manager -> Config):

```json
{
  "llm": { "provider": "nvidia", "model": "meta/llama-3.1-8b-instruct", "key": "nvapi-..." },
  "tts": { "provider": "magpie", "voice": "Aria", "key": "nvapi-..." },
  "stt": { "provider": "webspeech" }
}
```

### CORS proxy (needed for the AI voice and chat)

The app runs inside a browser frame, so AI providers (NVIDIA, OpenAI, Gemini) refuse its calls (CORS). The public `cors-anywhere` demo only works on a PC after unlocking it by hand, never on a TV. Deploy your own once:

1. Cloudflare dashboard -> Workers & Pages -> Create -> Worker, paste `tools/cors-proxy-worker.js`, deploy (free plan is enough).
2. In Config add `"corsProxy": { "enabled": true, "url": "https://<your-worker>.workers.dev/" }`.

The worker only forwards to NVIDIA, OpenAI and Google AI hosts and never stores keys. If the voice fails, the badge at the bottom left shows the reason (for example `request blocked (CORS?)` or the provider's error).

Keys, models and addresses are read only from this config; the app's AI screen no longer edits them. It only holds the switches (speaking exercises, AI lessons) and the CORS proxy for testing in a PC browser (turn it off on the TV). The config is visible to the app on every profile, so use keys you are happy to share with your users.
| `ai` | `false` | AI extras (Phase 4) |

## Releasing

`node tools/bump-version.mjs 2.1.0` updates `mypc-app.json`, `src/version.js` and every `?v=` in one go. Push, wait for
GitHub Pages, then press **Update** in the [App Store Manager](https://imad-os.github.io/g/installer/).

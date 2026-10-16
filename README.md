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
| `audioBase` | `""` | address of pre-generated voice clips (Phase 3); empty uses the device voice |
| `speech` | `true` | allow the device voice |
| `ai` | `false` | AI extras (Phase 4) |

## Releasing

`node tools/bump-version.mjs 2.1.0` updates `mypc-app.json`, `src/version.js` and every `?v=` in one go. Push, wait for
GitHub Pages, then press **Update** in the [App Store Manager](https://imad-os.github.io/g/installer/).

// Shared helpers for the content tools (Node 18+, no dependencies).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = path.join(ROOT, 'content', 'src');
export const BUILD = path.join(ROOT, 'content', 'build');
export const UI_LANGS = ['en', 'fr', 'es', 'ar'];

export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
}

// Every built document, as { path: 'courses/fr/lessons/b1-u01-l1', data }.
export function readBuild() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.json')) out.push({ path: path.relative(BUILD, full).replace(/\\/g, '/').replace(/\.json$/, ''), data: readJson(full) });
    }
  })(BUILD);
  return out;
}

// Word tiles for a sentence: punctuation dropped, split on spaces. The app uses the same rule (src/learning/text.js).
export function tokenize(text) {
  return text.replace(/[.,!?¿¡،؟;:"«»]/g, ' ').split(/\s+/).filter(Boolean);
}

// Deterministic random numbers, so a rebuild gives the same lessons.
export function rng(seedText) {
  let h = crypto.createHash('sha1').update(seedText).digest().readUInt32LE(0) || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

export function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function hash(text) { return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10); }

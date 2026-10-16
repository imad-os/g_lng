// Course content: picks a source (Firestore or the static copy), caches documents in memory,
// and keeps the small structural ones (catalog, course, level, unit) on the device between runs.
import { firestoreSource } from './firestore.js?v=2.5.7';
import { staticSource } from './static-source.js?v=2.5.7';
import { VERSION } from '../version.js?v=2.5.7';

const CACHE_KEY = 'dualingo_content_cache';
const memory = new Map();
let source = null;
let contentVersion = '';
let disk = {};

export async function openContent(config) {
  const fs = firestoreSource(config.firestoreProject, config.firestoreKey);
  const st = staticSource(VERSION);
  let catalog = null;
  if (config.contentSource !== 'static') {
    try { catalog = await fs.get('meta/catalog'); if (catalog) source = fs; }
    catch (e) { if (config.contentSource === 'firestore') throw e; }
  }
  if (!catalog) { catalog = await st.get('meta/catalog'); source = st; }
  if (!catalog) throw new Error('No content catalog');
  contentVersion = String(catalog.version || '');
  disk = readDisk();
  if (disk.version !== contentVersion || disk.source !== source.name) disk = { version: contentVersion, source: source.name, docs: {} };
  memory.set('meta/catalog', catalog);
  return catalog;
}

export function contentSourceName() { return source ? source.name : ''; }

export async function getDoc(path) {
  if (memory.has(path)) return memory.get(path);
  if (disk.docs && disk.docs[path]) { memory.set(path, disk.docs[path]); return disk.docs[path]; }
  const p = source.get(path).then((doc) => {
    memory.set(path, doc);
    if (doc && !/\/lessons\//.test(path)) { disk.docs[path] = doc; writeDisk(); }
    return doc;
  }, (e) => { memory.delete(path); throw e; });
  memory.set(path, p);
  return p;
}

export const getCourse = (lang) => getDoc(`courses/${lang}`);
export const getLevel = (lang, level) => getDoc(`courses/${lang}/levels/${level}`);
export const getUnit = (lang, unit) => getDoc(`courses/${lang}/units/${unit}`);
export const getLesson = (lang, lesson) => getDoc(`courses/${lang}/lessons/${lesson}`);
export const getLexicon = (lang, unit) => getDoc(`courses/${lang}/lexicon/${unit}`);

// A cache of content, not a save: progress lives in MyPC.save (src/data/progress-store.js).
function readDisk() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
}
let writeTimer = 0;
function writeDisk() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { writeTimer = 0; try { localStorage.setItem(CACHE_KEY, JSON.stringify(disk)); } catch (e) { /* full or blocked: memory cache still works */ } }, 500);
}
export function flushContentCache() {
  if (!writeTimer) return;
  clearTimeout(writeTimer); writeTimer = 0;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(disk)); } catch (e) { /* ignore */ }
}

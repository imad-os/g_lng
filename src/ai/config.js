// Optional AI switches. Saved only through MyPC.save (per profile). The AI service, model and keys are My PC's
// (Settings > AI on the TV); the owner can pick service and model in the App Store Manager (Config): see bridge.js.
import { loadExtra, saveExtra } from '../data/progress-store.js?v=2.7.1';
import { aiSupported } from './bridge.js?v=2.7.1';

export function aiConfig() {
  let saved = {};
  try { saved = loadExtra('ai', {}) || {}; } catch (e) { saved = {}; }
  return { enabled: saved.enabled !== false, speaking: saved.speaking !== false, aiLessons: saved.aiLessons !== false };
}

export function saveAiConfig(cfg) {
  saveExtra('ai', { enabled: cfg.enabled, speaking: cfg.speaking, aiLessons: cfg.aiLessons });
}

// AI lessons and explanations need a My PC with AI (API level 10) and the switches on.
export function aiReady() {
  const c = aiConfig();
  return c.enabled !== false && c.aiLessons !== false && aiSupported();
}

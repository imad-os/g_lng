// What the AI is doing right now, for the loader on voice buttons and the badge at the bottom left.
// kind: 'voice' | 'llm'. busy is true while a request to the provider is in flight.
const subs = new Set();
let state = { kind: '', busy: false, label: '' };

export const aiStatus = () => state;

export function setAiStatus(next) {
  state = { ...state, ...next };
  for (const fn of [...subs]) { try { fn(state); } catch (e) { /* a broken listener must not stop the others */ } }
}

export function onAiStatus(fn) { subs.add(fn); return () => subs.delete(fn); }

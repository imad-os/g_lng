// Same tile rule as tools/lib/common.mjs: punctuation dropped, split on spaces.
export function tokenize(text) {
  return String(text).replace(/[.,!?¿¡،؟;:"«»]/g, ' ').split(/\s+/).filter(Boolean);
}
export const sameText = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

// Focus manager: turns My PC actions (arrows, OK, cancel) into moves between [data-focus] elements.
// Input only ever comes from the SDK (onInput / MyPC.gamepad); this file never listens to keys.

let scopeStack = [];        // each scope: { root, handler, last }
let current = null;

export function pushScope(root, handler = {}) {
  scopeStack.push({ root, handler, last: null });
  focusFirst();
}

export function popScope(root) {
  const i = scopeStack.findIndex((s) => s.root === root);
  if (i >= 0) scopeStack.splice(i, 1);
  const top = scopeStack[scopeStack.length - 1];
  if (top && top.last && top.root.contains(top.last)) setFocus(top.last); else focusFirst();
}

export function replaceScope(root, handler) {
  scopeStack = [];
  pushScope(root, handler);
}

const top = () => scopeStack[scopeStack.length - 1];

function candidates() {
  const s = top();
  if (!s) return [];
  return Array.from(s.root.querySelectorAll('[data-focus]')).filter((el) => !el.classList.contains('disabled') && el.offsetParent !== null);
}

export function focusFirst(preferred) {
  const list = candidates();
  const el = (preferred && list.includes(preferred) && preferred) || list.find((e) => e.dataset.autofocus !== undefined) || list[0];
  setFocus(el || null);
}

export function setFocus(el) {
  if (current) current.classList.remove('focused');
  current = el;
  if (!el) return;
  el.classList.add('focused');
  const s = top();
  if (s) s.last = el;
  if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function focused() { return current; }

// Nearest element in a direction, preferring ones that line up with the current element.
function move(dir) {
  const list = candidates();
  if (!current || !list.includes(current)) { focusFirst(); return; }
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    let main, side;
    if (dir === 'left') { main = a.left - b.right; side = Math.abs(by - ay); if (bx >= ax) continue; }
    else if (dir === 'right') { main = b.left - a.right; side = Math.abs(by - ay); if (bx <= ax) continue; }
    else if (dir === 'up') { main = a.top - b.bottom; side = Math.abs(bx - ax); if (by >= ay) continue; }
    else { main = b.top - a.bottom; side = Math.abs(bx - ax); if (by <= ay) continue; }
    const score = Math.max(main, 0) + side * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) setFocus(best);
}

// Called from MyPC.init's onInput. Returns nothing; screens get onAction / onBack through their scope handler.
export function handleAction(action, pressed) {
  if (!pressed) return;
  const s = top();
  if (s && s.handler.onAction && s.handler.onAction(action) === true) return;
  if (action === 'left' || action === 'right' || action === 'up' || action === 'down') move(action);
  else if (action === 'confirm') { if (current && current._select && !current.classList.contains('disabled')) current._select(); }
  else if (action === 'cancel' && s && s.handler.onBack) s.handler.onBack();
}

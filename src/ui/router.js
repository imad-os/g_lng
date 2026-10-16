// One screen at a time; dialogs open above it with their own focus scope.
import { clear } from '../platform/dom.js?v=2.5.2';
import { replaceScope } from '../platform/input.js?v=2.5.2';

let screenEl = null;
let current = null;
let sdk = null;

export function initRouter(el, MyPC) { screenEl = el; sdk = MyPC; }

// screen: { el, onAction?, onBack?, onMenu?, menu?: [{id, label}], mounted?, destroy? }
export function show(screen) {
  if (current && current.destroy) current.destroy();
  clear(screenEl);
  screenEl.appendChild(screen.el);
  current = screen;
  replaceScope(screen.el, { onAction: screen.onAction, onBack: screen.onBack });
  sdk.setMenu(screen.menu || []);
  if (screen.mounted) screen.mounted();
}

export function menuChosen(id) { if (current && current.onMenu) current.onMenu(id); }

export function currentScreen() { return current; }

// Reusable pieces: dialogs, toasts, item text, speaker buttons.
import { h, focusable, ICONS } from '../platform/dom.js?v=2.1.0';
import { pushScope, popScope } from '../platform/input.js?v=2.1.0';
import { t } from '../platform/i18n.js?v=2.1.0';

let layer = null;
export function initComponents(el) { layer = el; }

// buttons: [{ label, kind: 'primary' | 'danger' | '', onSelect }]; Back / cancel closes it.
export function openDialog({ title, text, body, buttons }) {
  const back = h('div', { class: 'dialog-back' });
  const close = () => { if (back.parentNode) { back.remove(); popScope(back); } };
  const row = h('div', { class: 'row' }, buttons.map((b, i) => focusable(
    h('button', { class: `btn ${b.kind || ''}`, data: i === buttons.length - 1 ? { autofocus: '' } : {} }, b.label),
    () => { close(); if (b.onSelect) b.onSelect(); },
  )));
  back.appendChild(h('div', { class: 'dialog', role: 'dialog' }, h('h2', null, title), text ? h('p', null, text) : null, body || null, row));
  layer.appendChild(back);
  pushScope(back, { onBack: close });
  return close;
}

export function toast(text, ms = 2200) {
  const el = h('div', { class: 'toast' }, text);
  layer.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// The learned-language text of a word or sentence, with its transliteration underneath when it has one.
export function itemText(v, course, cls = '') {
  const tf = course && course.script === 'Tifinagh' ? ' tfng' : '';
  return h('span', { class: `item ${cls}` },
    h('span', { class: 'target' + tf, dir: 'auto', lang: course ? course.id : undefined }, v.t),
    v.tr ? h('span', { class: 'tr', dir: 'ltr' }, v.tr) : null);
}

export function speakerButton(onPlay, big = false) {
  return focusable(h('button', { class: `speaker${big ? ' big' : ''}`, 'aria-label': t('replay'), html: ICONS.speaker }), onPlay);
}

export function starsRow(n, max = 3) {
  return h('span', { class: 'stars' }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '', html: ICONS.star })));
}

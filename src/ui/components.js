// Reusable pieces: dialogs, toasts, item text, speaker buttons.
import { aiStatus, onAiStatus } from '../ai/status.js?v=2.6.0';
import { h, focusable, ICONS } from '../platform/dom.js?v=2.6.0';
import { pushScope, popScope } from '../platform/input.js?v=2.6.0';
import { t } from '../platform/i18n.js?v=2.6.0';

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

// Normal-speed speaker plus a slow one (turtle). onPlay(slow) says the item.
// Plays through onPlay(slow). While the voice provider is still preparing the audio the button shows a spinner.
function withLoader(btn, onPlay, slow) {
  onPlay(slow);
  if (!aiStatus().busy || aiStatus().kind !== 'voice') return;
  btn.classList.add('wait');
  const done = () => { btn.classList.remove('wait'); off(); clearTimeout(guard); };
  const off = onAiStatus((s) => { if (s.kind === 'voice' && !s.busy) done(); });
  const guard = setTimeout(done, 30000);
}

export function speakerButton(onPlay, big = false) {
  const normal = h('button', { class: `speaker${big ? ' big' : ''}`, 'aria-label': t('replay'), html: ICONS.speaker });
  const slow = h('button', { class: `speaker slow${big ? ' big' : ''}`, 'aria-label': t('slow'), html: ICONS.turtle });
  return h('span', { class: 'speakers' },
    focusable(normal, () => withLoader(normal, onPlay, false)),
    focusable(slow, () => withLoader(slow, onPlay, true)));
}

// Bottom-left badge: which AI model or voice is working (spinner) or just finished (fades after a few seconds).
export function initAiBadge() {
  const badge = h('div', { class: 'ai-badge', hidden: true });
  layer.appendChild(badge);
  let hide = 0;
  onAiStatus((s) => {
    clearTimeout(hide);
    badge.hidden = !s.label;
    badge.className = `ai-badge ${s.busy ? 'busy' : ''} ${s.error ? 'err' : ''}`;
    badge.textContent = s.error ? `⚠ ${s.label}: ${s.error}` : `${s.kind === 'voice' ? '🔊' : '🤖'} ${s.label}`;
    if (!s.busy) hide = setTimeout(() => { badge.hidden = true; }, s.error ? 9000 : 4000);
  });
}

export function starsRow(n, max = 3) {
  return h('span', { class: 'stars' }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '', html: ICONS.star })));
}

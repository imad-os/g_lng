// Tiny DOM helper: h('div', { class: 'card', data: { focus: '' } }, 'text', child)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'html') el.innerHTML = v;   // only for trusted, static markup (icons)
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

// A focusable control. onSelect runs on OK / Enter / gamepad A, or a click.
export function focusable(el, onSelect) {
  el.dataset.focus = '';
  el._select = onSelect;
  el.addEventListener('click', () => { if (el._select && !el.classList.contains('disabled')) el._select(); });
  return el;
}

export const ICONS = {
  speaker: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" width="28" height="28" fill="#ff9600"><path d="M13.5.7s.7 2.5.7 4.6c0 2-1.3 3.6-3.3 3.6S7.4 7.3 7.4 5.3l.1-.4C5.4 7.4 4 10.6 4 14a8 8 0 0 0 16 0C20 8.6 17.4 3.8 13.5.7z"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2l3 7h7l-5.6 4.3 2.1 7.2L12 16.3 5.5 20.5l2.1-7.2L2 9h7z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 1-2z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M7 2h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15v3h4v3H7v-3h4v-3a5 5 0 0 1-3.4-3A5 5 0 0 1 3 7V4h4V2zm0 4H5v1a3 3 0 0 0 2 2.8V6zm10 0v3.8A3 3 0 0 0 19 7V6h-2z"/></svg>',
  turtle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5C7.6 5 4 8 4 12v1h14v-1c0-4-2.600-7-6-7zM2 14v2h3l1 2h2l-1-2h8l-1 2h2l1-2h4v-2H2zm19-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M17 9V7A5 5 0 0 0 7 7v2H5v13h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7z"/></svg>',
};

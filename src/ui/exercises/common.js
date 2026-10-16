// Shared parts of the exercise screens.
import { h, focusable } from '../../platform/dom.js?v=2.1.0';

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// A grid of one-pick options. Picking one answers the exercise at once (TV remote: one press of OK).
export function choiceGrid(options, { isRight, onPick, columns = 2 }) {
  const grid = h('div', { class: `choices cols-${columns}` });
  const els = options.map((o, i) => {
    const el = focusable(h('button', { class: 'option', data: i === 0 ? { autofocus: '' } : {} }, o.content), () => {
      if (grid.dataset.answered) return;
      grid.dataset.answered = '1';
      const ok = isRight(o);
      el.classList.add(ok ? 'right' : 'wrong');
      if (!ok) for (const [i, other] of options.entries()) if (isRight(other)) els[i].classList.add('right');
      onPick(o, ok);
    });
    grid.appendChild(el);
    return el;
  });
  return grid;
}

export const gloss = (v, from) => (v && v.g && (v.g[from] || v.g.en)) || '';

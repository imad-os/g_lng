// match_pairs: pick a word on the left, then its meaning on the right.
import { h, focusable } from '../../platform/dom.js?v=2.5.1';
import { setFocus } from '../../platform/input.js?v=2.5.1';
import { sfx } from '../../platform/audio.js?v=2.5.1';
import { itemText } from '../components.js?v=2.5.1';
import { gloss, shuffle } from './common.js?v=2.5.1';

export default function matchPairs(ctx) {
  const { ex, vocab, from, course } = ctx;
  let picked = null;
  let matched = 0;
  let mistakes = 0;
  const wrongWords = new Set();
  const left = h('div', { class: 'col' });
  const right = h('div', { class: 'col' });

  const leftEls = shuffle(ex.items).map((k) => {
    const el = focusable(h('button', { class: 'option' }, itemText(vocab[k], course)), () => {
      if (el.classList.contains('done')) return;
      if (picked) picked.classList.remove('picked');
      picked = el; el.classList.add('picked');
      ctx.say(k);
      const firstFree = rightEls.find((r) => !r.classList.contains('done'));
      if (firstFree) setFocus(firstFree);
    });
    el.dataset.key = k;
    left.appendChild(el);
    return el;
  });
  const rightEls = shuffle(ex.items).map((k) => {
    const el = focusable(h('button', { class: 'option' }, h('span', { dir: 'auto' }, gloss(vocab[k], from))), () => {
      if (el.classList.contains('done') || !picked) return;
      if (picked.dataset.key === k) {
        picked.classList.remove('picked'); picked.classList.add('done', 'disabled'); el.classList.add('done', 'disabled');
        picked = null; matched++;
        sfx('right');
        if (matched === ex.items.length) {
          const words = [...ex.items];
          ctx.answer(mistakes === 0, { picked: '', solution: '', words, wrongWords: [...wrongWords] });
        } else {
          const next = leftEls.find((x) => !x.classList.contains('done'));
          if (next) setFocus(next);
        }
      } else {
        mistakes++;
        wrongWords.add(picked.dataset.key);
        sfx('wrong');
        el.classList.add('wrong');
        setTimeout(() => el.classList.remove('wrong'), 500);
      }
    });
    right.appendChild(el);
    return el;
  });

  return { el: h('div', { class: 'ex ex-match' }, h('div', { class: 'match' }, left, right)) };
}

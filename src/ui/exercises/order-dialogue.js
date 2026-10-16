// order_dialogue: put the lines of a short conversation in order.
import { h, focusable, clear } from '../../platform/dom.js?v=2.5.5';
import { setFocus } from '../../platform/input.js?v=2.5.5';
import { itemText } from '../components.js?v=2.5.5';
import { gloss, shuffle } from './common.js?v=2.5.5';

export default function orderDialogue(ctx) {
  const { ex, vocab, from, course } = ctx;
  const order = [];
  const chat = h('div', { class: 'chat' });
  const pool = h('div', { class: 'pool' });
  let locked = false;

  const lines = shuffle(ex.items).map((k) => {
    const el = focusable(h('button', { class: 'option line' }, itemText(vocab[k], course)), () => {
      if (locked || el.classList.contains('used')) return;
      el.classList.add('used', 'disabled');
      order.push(k);
      ctx.say(k);
      render();
      const next = lines.find((x) => !x.classList.contains('used'));
      if (next) setFocus(next); else ctx.focusCheck();
    });
    el._key = k;
    pool.appendChild(el);
    return el;
  });

  function render() {
    clear(chat);
    order.forEach((k, i) => {
      const bubble = focusable(h('button', { class: `bubble ${i % 2 ? 'b' : 'a'}` }, itemText(vocab[k], course), h('span', { class: 'muted small', dir: 'auto' }, gloss(vocab[k], from))), () => {
        if (locked) return;
        order.splice(i, 1);
        const back = lines.find((x) => x.classList.contains('used') && x._key === k);
        if (back) { back.classList.remove('used', 'disabled'); }
        render();
        if (back) setFocus(back);
      });
      chat.appendChild(bubble);
    });
    ctx.setReady(order.length === ex.items.length);
  }
  return {
    el: h('div', { class: 'ex ex-order' }, chat, pool),
    check() {
      locked = true;
      const ok = order.every((k, i) => k === ex.items[i]);
      chat.classList.add(ok ? 'right' : 'wrong');
      ctx.answer(ok, { picked: '', solution: ex.items.map((k) => vocab[k].t).join(' / ') });
    },
  };
}

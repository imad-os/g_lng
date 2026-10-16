// word_bank: build the sentence from word tiles. OK on a tile in the bank adds it; OK on a placed tile removes it.
import { h, focusable, clear } from '../../platform/dom.js?v=2.5.0';
import { setFocus } from '../../platform/input.js?v=2.5.0';
import { tokenize, sameText } from '../../learning/text.js?v=2.5.0';
import { gloss, shuffle } from './common.js?v=2.5.0';

export default function wordBank(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const answer = tokenize(item.t);
  const tf = course.script === 'Tifinagh' ? ' tfng' : '';
  const dir = course.rtl ? 'rtl' : 'ltr';
  const line = h('div', { class: 'answer-line', dir });
  const bank = h('div', { class: 'bank', dir });
  const placed = [];

  const tiles = shuffle([...answer, ...ex.extra]).map((w) => {
    const tile = focusable(h('button', { class: 'tile' + tf }, w), () => {
      if (tile.classList.contains('used') || bank.dataset.locked) return;
      tile.classList.add('used');
      placed.push(tile);
      render();
      const next = tiles.find((x) => !x.classList.contains('used'));
      if (placed.length >= answer.length || !next) ctx.focusCheck(); else setFocus(next);
    });
    bank.appendChild(tile);
    return tile;
  });

  function render() {
    clear(line);
    placed.forEach((tile, i) => {
      const chip = focusable(h('button', { class: 'tile' + tf }, tile.textContent), () => {
        if (bank.dataset.locked) return;
        placed.splice(i, 1);
        tile.classList.remove('used');
        render();
        setFocus(tile);
      });
      line.appendChild(chip);
    });
    ctx.setReady(placed.length > 0);
  }

  return {
    el: h('div', { class: 'ex ex-bank' }, h('div', { class: 'ex-head' }, h('span', { class: 'meaning', dir: 'auto' }, gloss(item, from))), line, bank),
    check() {
      bank.dataset.locked = '1';
      const words = placed.map((x) => x.textContent);
      const ok = words.length === answer.length && words.every((w, i) => sameText(w, answer[i]));
      line.classList.add(ok ? 'right' : 'wrong');
      ctx.answer(ok, { picked: words.join(' '), solution: item.t });
      if (ok) ctx.say(ex.item);
    },
  };
}

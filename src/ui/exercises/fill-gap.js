// fill_gap: pick the missing word of a sentence.
import { h } from '../../platform/dom.js?v=2.7.0';
import { tokenize } from '../../learning/text.js?v=2.7.0';
import { choiceGrid, gloss, shuffle } from './common.js?v=2.7.0';

export default function fillGap(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const toks = tokenize(item.t);
  const tf = course.script === 'Tifinagh' ? ' tfng' : '';
  const sentence = h('div', { class: 'gap-sentence' + tf, dir: 'auto' },
    toks.map((w, i) => (i === ex.gap ? h('span', { class: 'gap' }, ' ') : h('span', null, w))));
  const options = shuffle(ex.opts).map((w) => ({ w, content: h('span', { class: tf.trim(), dir: 'auto' }, w) }));
  const grid = choiceGrid(options, {
    isRight: (o) => o.w === toks[ex.gap],
    onPick: (o, ok) => {
      sentence.querySelector('.gap').textContent = toks[ex.gap];
      ctx.answer(ok, { picked: o.w, solution: item.t });
      if (ok) ctx.say(ex.item);
    },
    columns: 4,
  });
  return { el: h('div', { class: 'ex ex-gap' }, h('div', { class: 'ex-head column' }, sentence, h('div', { class: 'muted', dir: 'auto' }, gloss(item, from))), grid) };
}

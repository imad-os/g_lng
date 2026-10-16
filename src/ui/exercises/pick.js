// pick_translation (see the learned word, pick its meaning), pick_target (see the meaning, pick the word),
// listen_pick (hear it, pick the word).
import { h } from '../../platform/dom.js?v=2.1.0';
import { itemText, speakerButton } from '../components.js?v=2.1.0';
import { choiceGrid, gloss, shuffle } from './common.js?v=2.1.0';

export default function pick(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const showMeaning = ex.type === 'pick_translation';
  let head;
  if (ex.type === 'pick_translation') head = h('div', { class: 'ex-head' }, speakerButton(() => ctx.say(ex.item)), itemText(item, course, 'big'));
  else if (ex.type === 'pick_target') head = h('div', { class: 'ex-head' }, h('span', { class: 'meaning big', dir: 'auto' }, gloss(item, from)));
  else head = h('div', { class: 'ex-head center' }, speakerButton(() => ctx.say(ex.item), true));

  const options = shuffle(ex.opts).map((k) => ({
    key: k,
    content: showMeaning ? h('span', { dir: 'auto' }, gloss(vocab[k], from)) : itemText(vocab[k], course),
  }));
  const grid = choiceGrid(options, {
    isRight: (o) => o.key === ex.item,
    onPick: (o, ok) => {
      if (!showMeaning) ctx.say(o.key);
      const picked = showMeaning ? gloss(vocab[o.key], from) : vocab[o.key].t;
      ctx.answer(ok, { picked, solution: showMeaning ? `${item.t} = ${gloss(item, from)}` : `${item.t} = ${gloss(item, from)}` });
    },
  });
  return {
    el: h('div', { class: 'ex ex-pick' }, head, grid),
    autoplay: ex.type !== 'pick_target' ? () => ctx.say(ex.item) : null,
  };
}

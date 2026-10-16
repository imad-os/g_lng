// true_false: does this word or sentence mean what is shown?
import { h } from '../../platform/dom.js?v=2.3.0';
import { t } from '../../platform/i18n.js?v=2.3.0';
import { itemText, speakerButton } from '../components.js?v=2.3.0';
import { choiceGrid, gloss } from './common.js?v=2.3.0';

export default function trueFalse(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const head = h('div', { class: 'ex-head column' },
    h('div', { class: 'ex-head' }, speakerButton((slow) => ctx.say(ex.item, slow)), itemText(item, course, 'big')),
    h('div', { class: 'means' }, h('span', { class: 'muted' }, t('means')), ' ', h('b', { dir: 'auto' }, `“${gloss(vocab[ex.shown], from)}”`)));
  const options = [{ value: true, content: t('trueWord') }, { value: false, content: t('falseWord') }];
  const grid = choiceGrid(options, {
    isRight: (o) => o.value === ex.answer,
    onPick: (o, ok) => ctx.answer(ok, { picked: o.content, solution: `${item.t} = ${gloss(item, from)}` }),
  });
  return { el: h('div', { class: 'ex ex-tf' }, head, grid), autoplay: () => ctx.say(ex.item) };
}

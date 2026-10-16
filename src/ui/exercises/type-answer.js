// type_answer: see the meaning, type the word. Case, punctuation and accents are forgiven.
import { h, focusable } from '../../platform/dom.js?v=2.5.3';
import { t } from '../../platform/i18n.js?v=2.5.3';
import { speakerButton } from '../components.js?v=2.5.3';
import { gloss } from './common.js?v=2.5.3';

export const normalize = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

export default function typeAnswer(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const input = h('input', { class: 'type-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: course.id, dir: 'auto', placeholder: t('typeHere') });
  // A text field is the one place that needs real keys: keep them away from the SDK's key-to-action mapping
  // (it would swallow spaces and backspace). Everything else in the app still goes through MyPC input.
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); ctx.focusCheck(); }
  };
  input.addEventListener('input', () => ctx.setReady(input.value.trim().length > 0));
  const field = focusable(h('div', { class: 'type-field', data: { autofocus: '' } }, input), () => input.focus());
  const skip = focusable(h('button', { class: 'btn small-btn' }, t('skip')), () => ctx.answer(true, { skipped: true, words: [], solution: item.t }));
  return {
    el: h('div', { class: 'ex ex-type' },
      h('div', { class: 'ex-head' }, speakerButton((slow) => ctx.say(ex.item, slow)), h('span', { class: 'meaning big', dir: 'auto' }, gloss(item, from))),
      field, h('div', null, skip)),
    check() {
      const ok = normalize(input.value) === normalize(item.t);
      input.blur();
      ctx.answer(ok, { picked: input.value, solution: item.t });
    },
  };
}

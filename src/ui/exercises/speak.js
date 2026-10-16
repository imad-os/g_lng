// speak: read the sentence aloud. The device listens when it can; otherwise the learner says it and confirms.
import { h, focusable } from '../../platform/dom.js?v=2.5.5';
import { t } from '../../platform/i18n.js?v=2.5.5';
import { itemText, speakerButton } from '../components.js?v=2.5.5';
import { sttAvailable, listenOnce } from '../../ai/speech.js?v=2.5.5';
import { gloss } from './common.js?v=2.5.5';
import { normalize } from './type-answer.js?v=2.5.5';

function matches(heard, target) {
  const want = normalize(target).split(' ').filter(Boolean);
  const got = new Set(normalize(heard).split(' '));
  if (!want.length) return false;
  return want.filter((w) => got.has(w)).length / want.length >= 0.6;
}

export default function speak(ctx) {
  const { ex, vocab, from, course } = ctx;
  const item = vocab[ex.item];
  const note = h('div', { class: 'small muted speak-note' }, sttAvailable() ? t('speakHint') : t('noMic'));
  let listening = false;
  const said = focusable(h('button', { class: 'btn', data: sttAvailable() ? {} : { autofocus: '' } }, t('saidIt')), () => ctx.answer(true, { picked: '', solution: item.t, words: [] }));
  const skip = focusable(h('button', { class: 'btn small-btn' }, t('skip')), () => ctx.answer(true, { skipped: true, words: [], solution: item.t }));
  const mic = sttAvailable() ? focusable(h('button', { class: 'btn blue', data: { autofocus: '' } }, '🎤 ', t('speakNow')), async () => {
    if (listening) return;
    listening = true;
    note.textContent = t('listening');
    try {
      const heard = await listenOnce(course.tts);
      if (!heard) { note.textContent = t('heardNothing'); listening = false; return; }
      ctx.answer(matches(heard, item.t), { picked: heard, solution: item.t, words: [] });
    } catch (e) {
      note.textContent = t('micBlocked');
      listening = false;
    }
  }) : null;
  return {
    el: h('div', { class: 'ex ex-speak' },
      h('div', { class: 'ex-head' }, speakerButton((slow) => ctx.say(ex.item, slow)), itemText(item, course, 'big')),
      h('div', { class: 'meaning', dir: 'auto' }, gloss(item, from)),
      h('div', { class: 'row-gap' }, mic, said, skip), note),
  };
}

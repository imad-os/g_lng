// The lesson player: one exercise at a time, Check / Continue in the footer, mistakes retried at the end.
import { h, focusable, clear } from '../../platform/dom.js?v=2.0.0';
import { t } from '../../platform/i18n.js?v=2.0.0';
import { setFocus, focusFirst } from '../../platform/input.js?v=2.0.0';
import { say, sfx, canSpeak, preload, stopVoice } from '../../platform/audio.js?v=2.0.0';
import { LessonRun, wordsOf } from '../../learning/lesson-engine.js?v=2.0.0';
import { finishLesson } from '../../learning/session.js?v=2.0.0';
import { openDialog } from '../components.js?v=2.0.0';
import pick from '../exercises/pick.js?v=2.0.0';
import trueFalse from '../exercises/true-false.js?v=2.0.0';
import fillGap from '../exercises/fill-gap.js?v=2.0.0';
import wordBank from '../exercises/word-bank.js?v=2.0.0';
import matchPairs from '../exercises/match-pairs.js?v=2.0.0';
import orderDialogue from '../exercises/order-dialogue.js?v=2.0.0';

const EXERCISES = {
  pick_translation: pick, pick_target: pick, listen_pick: pick,
  true_false: trueFalse, fill_gap: fillGap, word_bank: wordBank, match_pairs: matchPairs, order_dialogue: orderDialogue,
};

export function lessonScreen(app, lesson) {
  const course = app.courseDoc;
  const run = new LessonRun(lesson, { canHear: canSpeak(course.tts) });
  const bar = h('i', { style: 'transform: scaleX(0)' });
  const prompt = h('h2', { class: 'prompt' });
  const area = h('div', { class: 'ex-area' });
  const status = h('div', { class: 'status' });
  const button = h('button', { class: 'btn primary wide' });
  const footer = h('div', { class: 'footer' }, status, button);
  let mounted = null;
  let phase = 'answer';           // 'answer' -> 'feedback'
  let timer = 0;

  const sayKey = (k) => say(lesson.vocab[k], course.tts);
  focusable(button, () => {
    if (button.classList.contains('disabled')) return;
    if (phase === 'answer' && mounted && mounted.check) mounted.check();
    else if (phase === 'feedback') next();
  });

  preload(Object.values(lesson.vocab).map((v) => v.a));

  function showExercise() {
    const ex = run.current;
    phase = 'answer';
    clear(area); clear(status);
    footer.className = 'footer';
    bar.style.transform = `scaleX(${run.progress})`;
    prompt.textContent = t(`prompts.${ex.type}`);
    mounted = EXERCISES[ex.type]({
      ex, vocab: lesson.vocab, from: app.from, course,
      say: sayKey,
      answer: (ok, detail) => onAnswer(ex, ok, detail),
      setReady: (ready) => button.classList.toggle('disabled', !ready),
      focusCheck: () => setFocus(button),
    });
    area.appendChild(mounted.el);
    const needsCheck = !!mounted.check;
    button.textContent = t('check');
    button.classList.toggle('hidden', !needsCheck);
    button.classList.toggle('disabled', needsCheck);
    focusFirst();
    if (mounted.autoplay) timer = setTimeout(mounted.autoplay, 250);
  }

  function onAnswer(ex, ok, detail) {
    phase = 'feedback';
    run.answer(ok, { ...detail, words: detail.words || wordsOf(ex, lesson.vocab) });
    sfx(ok ? 'right' : 'wrong');
    for (const el of area.querySelectorAll('[data-focus]')) el.classList.add('disabled');
    footer.className = `footer ${ok ? 'good' : 'bad'}`;
    clear(status);
    const praise = t('praise');
    status.appendChild(ok
      ? h('b', null, praise[Math.floor(Math.random() * praise.length)])
      : h('div', null, h('b', null, t('wrong')), detail.solution ? h('div', { class: 'solution' }, t('answerWas'), ' ', h('span', { dir: 'auto', class: course.script === 'Tifinagh' ? 'tfng' : '' }, detail.solution)) : null));
    app.MyPC.announce(ok ? status.textContent : `${t('wrong')}. ${detail.solution || ''}`);
    button.textContent = t('continue');
    button.classList.remove('hidden', 'disabled');
    bar.style.transform = `scaleX(${run.progress})`;
    setFocus(button);
  }

  function next() {
    clearTimeout(timer);
    stopVoice();
    run.next();
    if (!run.done) { showExercise(); return; }
    const result = finishLesson(app.lang, lesson, run);
    sfx('done');
    app.go.results(lesson, result);
  }

  function confirmQuit() {
    openDialog({
      title: t('quitTitle'), text: t('quitText'),
      buttons: [{ label: t('quit'), kind: 'danger', onSelect: () => app.go.home() }, { label: t('keepGoing'), kind: 'primary' }],
    });
  }

  return {
    el: h('div', { class: 'lesson' }, h('div', { class: 'lesson-top' }, h('div', { class: 'bar grow' }, bar)), prompt, area, footer),
    menu: [{ id: 'quit', label: t('menuQuit') }],
    onMenu: (id) => { if (id === 'quit') app.go.home(); },
    onBack: confirmQuit,
    mounted: showExercise,
    destroy: () => { clearTimeout(timer); stopVoice(); },
  };
}

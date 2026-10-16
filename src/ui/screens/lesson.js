// The lesson player: one exercise at a time with a progress bar and counter, hearts, combo, Check / Continue
// in the footer, and mistakes retried at the end.
import { h, focusable, clear, ICONS } from '../../platform/dom.js?v=2.5.1';
import { t } from '../../platform/i18n.js?v=2.5.1';
import { setFocus, focusFirst, focused } from '../../platform/input.js?v=2.5.1';
import { say, sfx, canSpeak, preload, stopVoice } from '../../platform/audio.js?v=2.5.1';
import { LessonRun, wordsOf, MAX_HEARTS } from '../../learning/lesson-engine.js?v=2.5.1';
import { finishLesson } from '../../learning/session.js?v=2.5.1';
import { getMe, saveMe } from "../../data/progress-store.js?v=2.5.1";
import { openDialog, itemText } from '../components.js?v=2.5.1';
import { mascot } from '../mascot.js?v=2.5.1';
import pick from '../exercises/pick.js?v=2.5.1';
import trueFalse from '../exercises/true-false.js?v=2.5.1';
import fillGap from '../exercises/fill-gap.js?v=2.5.1';
import wordBank from '../exercises/word-bank.js?v=2.5.1';
import matchPairs from '../exercises/match-pairs.js?v=2.5.1';
import orderDialogue from '../exercises/order-dialogue.js?v=2.5.1';
import typeAnswer from '../exercises/type-answer.js?v=2.5.1';
import speak from '../exercises/speak.js?v=2.5.1';

const EXERCISES = {
  pick_translation: pick, pick_target: pick, listen_pick: pick,
  true_false: trueFalse, fill_gap: fillGap, word_bank: wordBank, match_pairs: matchPairs, order_dialogue: orderDialogue,
  type_answer: typeAnswer, speak,
};
const REFILL_COST = 10;

export function lessonScreen(app, lesson) {
  const course = app.courseDoc;
  const me = getMe();
  const run = new LessonRun(lesson, { canHear: canSpeak(course.tts) });
  const bar = h('i', { style: 'transform: scaleX(0)' });
  const counter = h('span', { class: 'counter' });
  const combo = h('span', { class: 'combo hidden' });
  const hearts = h('span', { class: 'hearts' });
  const prompt = h('h2', { class: 'prompt' });
  const area = h('div', { class: 'ex-area' });
  const coach = h('span', { class: 'coach-slot' });
  const status = h('div', { class: 'status' });
  const button = h('button', { class: 'btn primary wide' });
  const explainBtn = app.ai && app.ai.ready() ? focusable(h('button', { class: 'btn small-btn' }, '💡 ', t('explain')), explain) : null;
  const footer = h('div', { class: 'footer' }, h('div', { class: 'footer-msg' }, coach, status), h('div', { class: 'footer-btns' }, explainBtn, button));
  const quit = focusable(h('button', { class: 'btn small-btn quit', 'aria-label': t('quit') }, '✕'), () => confirmQuit());
  let mounted = null;
  let phase = 'answer';           // 'answer' -> 'feedback'
  let timer = 0;

  const sayKey = (k, slow) => say(lesson.vocab[k], course.tts, slow);
  focusable(button, () => {
    if (button.classList.contains('disabled')) return;
    if (phase === 'intro') showExercise();
    else if (phase === 'answer' && mounted && mounted.check) mounted.check();
    else if (phase === 'feedback') next();
  });

  preload(Object.values(lesson.vocab).map((v) => v.a));

  function drawHud() {
    const shown = Math.min(run.pos + (phase === 'feedback' ? 1 : 0), run.total);
    counter.textContent = run.pos >= run.total ? t('retryRound') : `${Math.min(run.pos + 1, run.total)}/${run.total}`;
    bar.style.transform = `scaleX(${Math.min(1, shown / run.total)})`;
    hearts.textContent = run.hearts === Infinity ? '' : `❤️ ${Math.max(0, run.hearts)}`;
    hearts.classList.toggle('hidden', run.hearts === Infinity);
    combo.textContent = `🔥 ${run.combo}x`;
    combo.classList.toggle('hidden', run.combo < 2);
  }

  function setCoach(mood) { clear(coach); if (mood) coach.appendChild(mascot(mood, 72)); }

  // New words are shown first, with their sound and meaning, before any question about them.
  function showIntro() {
    phase = 'intro';
    clear(area); clear(status); setCoach(null);
    footer.className = 'footer';
    counter.textContent = `0/${run.total}`;
    bar.style.transform = 'scaleX(0)';
    prompt.textContent = t('newWords');
    const list = h('div', { class: 'intro-list' });
    for (const k of lesson.newWords) {
      const v = lesson.vocab[k];
      if (!v) continue;
      list.appendChild(focusable(h('button', { class: 'intro-row' },
        h('span', { class: 'intro-sound', html: ICONS.speaker }), itemText(v, course, 'big'), h('span', { class: 'intro-meaning', dir: 'auto' }, v.g[app.from] || v.g.en)),
      () => sayKey(k, false)));
    }
    area.appendChild(list);
    button.textContent = t('startLesson');
    button.classList.remove('hidden', 'disabled');
    if (explainBtn) explainBtn.classList.add('hidden');
    setFocus(button);
    timer = setTimeout(() => sayKey(lesson.newWords[0], false), 400);
  }

  function showExercise() {
    const ex = run.current;
    phase = 'answer';
    clear(area); clear(status); setCoach(null);
    footer.className = 'footer';
    drawHud();
    prompt.textContent = ex.retry ? `${t('retryRound')} · ${t(`prompts.${ex.type}`)}` : t(`prompts.${ex.type}`);
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
    if (explainBtn) explainBtn.classList.remove('hidden');
    // Start on the exercise itself, not on the quit button above it.
    setFocus(area.querySelector('[data-autofocus]') || area.querySelector('[data-focus]:not(.disabled)') || (needsCheck ? null : button));
    if (!focused()) focusFirst();
    if (mounted.autoplay) timer = setTimeout(mounted.autoplay, 250);
  }

  function onAnswer(ex, ok, detail) {
    phase = 'feedback';
    const before = run.hearts;
    run.answer(ok, { ...detail, words: detail.words || wordsOf(ex, lesson.vocab) });
    if (detail.skipped) sfx('tap');
    else if (ok) { sfx('right', run.combo); if (run.combo === 3 || run.combo === 5 || run.combo === 8) sfx('swoosh'); }
    else { sfx('wrong'); if (run.hearts < before) setTimeout(() => sfx('heart'), 260); }
    for (const el of area.querySelectorAll('[data-focus]')) el.classList.add('disabled');
    footer.className = `footer ${ok ? 'good' : 'bad'}`;
    clear(status);
    setCoach(detail.skipped ? 'think' : ok ? (run.combo >= 3 ? 'cheer' : 'happy') : 'sad');
    const praise = t('praise');
    status.appendChild(detail.skipped ? h('b', null, t('skipped'))
      : ok ? h('b', null, praise[Math.floor(Math.random() * praise.length)])
        : h('div', null, h('b', null, t('wrong')), detail.solution ? h('div', { class: 'solution' }, t('answerWas'), ' ', h('span', { dir: 'auto', class: course.script === 'Tifinagh' ? 'tfng' : '' }, detail.solution)) : null));
    app.MyPC.announce(ok ? status.textContent : `${t('wrong')}. ${detail.solution || ''}`);
    button.textContent = t('continue');
    button.classList.remove('hidden', 'disabled');
    drawHud();
    setFocus(button);
    if (run.outOfHearts) setTimeout(outOfHearts, 700);
  }

  function outOfHearts() {
    sfx('fail');
    const buttons = [];
    if (me.gems >= REFILL_COST) buttons.push({ label: t('refillHearts', { n: REFILL_COST }), kind: 'blue', onSelect: () => { me.gems -= REFILL_COST; saveMe(); sfx('gem'); run.refill(3); drawHud(); } });
    buttons.push({ label: t('tryAgain'), onSelect: () => app.go.play(lesson) });
    buttons.push({ label: t('quit'), kind: 'danger', onSelect: () => app.go.home() });
    openDialog({ title: t('outOfHearts'), text: t('outOfHeartsText'), buttons });
  }

  function next() {
    clearTimeout(timer);
    stopVoice();
    if (run.outOfHearts) return;
    run.next();
    if (!run.done) { showExercise(); return; }
    const result = finishLesson(app.lang, lesson, run);
    sfx('done');
    app.go.results(lesson, result);
  }

  async function explain() {
    const ex = run.current;
    const body = h('p', { class: 'ai-text' }, t('thinking'));
    openDialog({ title: t('explain'), body, buttons: [{ label: t('close'), kind: 'primary' }] });
    try { body.textContent = await app.ai.explainExercise(lesson, ex); } catch (e) { body.textContent = e.message || t('loadFailed'); }
  }

  function confirmQuit() {
    openDialog({
      title: t('quitTitle'), text: t('quitText'),
      buttons: [{ label: t('quit'), kind: 'danger', onSelect: () => app.go.home() }, { label: t('keepGoing'), kind: 'primary' }],
    });
  }

  return {
    el: h('div', { class: 'lesson' }, h('div', { class: 'lesson-top' }, quit, h('div', { class: 'bar grow' }, bar), counter, combo, hearts), prompt, area, footer),
    menu: [{ id: 'quit', label: t('menuQuit') }],
    onMenu: (id) => { if (id === 'quit') app.go.home(); },
    onBack: confirmQuit,
    onAction: (action) => {
      if (action === 'run' && mounted && mounted.autoplay && phase === 'answer') { mounted.autoplay(); return true; }
      return false;
    },
    mounted: () => (lesson.newWords && lesson.newWords.length && !lesson.review ? showIntro() : showExercise()),
    destroy: () => { clearTimeout(timer); stopVoice(); },
  };
}

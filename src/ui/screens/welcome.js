// First-run and "add a language" flow: who you are (language you speak) -> what to learn -> where to start,
// with "I am not sure" leading to a 12-question placement quiz that also offers "I am not sure" on every question.
import { h, focusable, clear } from '../../platform/dom.js?v=2.5.1';
import { t, pickLang, setUiLang, UI_LANGS } from '../../platform/i18n.js?v=2.5.1';
import { getMe, saveMe } from '../../data/progress-store.js?v=2.5.1';
import { getCourse } from '../../data/content-repo.js?v=2.5.1';
import { sfx, say } from '../../platform/audio.js?v=2.5.1';
import { buildQuiz, estimateLevel, QUIZ_LENGTH } from '../../learning/placement.js?v=2.5.1';
import { toast, itemText, speakerButton } from '../components.js?v=2.5.1';
import { choiceGrid, gloss } from '../exercises/common.js?v=2.5.1';
import { setFocus } from '../../platform/input.js?v=2.5.1';

const NATIVE = { en: 'English', fr: 'Français', es: 'Español', ar: 'العربية' };

// Step 1: the language you speak (also the language of the app and of the translations).
export function speakScreen(app) {
  const me = getMe();
  const title = h('h1', null, t('iSpeakQuestion'));
  const grid = h('div', { class: 'course-grid' });
  for (const l of UI_LANGS) {
    grid.appendChild(focusable(h('button', { class: `course-card${me.from === l ? ' current' : ''}`, data: me.from === l ? { autofocus: '' } : {} },
      h('span', { class: 'native', dir: 'auto' }, NATIVE[l])), () => {
      me.from = l; me.ui = l; setUiLang(l); saveMe();
      sfx('pick');
      app.go.learnWhat();
    }));
  }
  return { el: h('div', { class: 'page welcome' }, h('div', { class: 'welcome-mascot' }, app.mascot('cheer', 120)), title, grid), onBack: () => {} };
}

// Step 2: what to learn. Used on its own too, to add another language.
export function learnWhatScreen(app, { canGoBack = true } = {}) {
  const me = getMe();
  const grid = h('div', { class: 'course-grid' });
  for (const c of app.catalog.courses) {
    if (c.id === me.from) continue;
    const ready = c.ready && c.ready.length > 0;
    const have = me.started.includes(c.id);
    grid.appendChild(focusable(h('button', { class: `course-card${have ? ' current' : ''}${ready ? '' : ' soon'}`, data: grid.childElementCount === 0 ? { autofocus: '' } : {} },
      h('span', { class: `native${c.id === 'zgh' ? ' tfng' : ''}`, dir: 'auto' }, c.native),
      pickLang(c.name) !== c.native ? h('span', { class: 'name' }, pickLang(c.name)) : null,
      h('span', { class: 'muted small' }, ready ? (have ? t('alreadyLearning') : `${c.levels.length} ${t('levels')}`) : t('comingSoon'))), () => {
      if (!ready) { toast(t('comingSoon')); return; }
      if (have) { app.go.pickCourse(c.id); return; }
      app.go.chooseLevel(c.id);
    }));
  }
  const back = canGoBack ? focusable(h('button', { class: 'btn' }, t('back')), () => (me.started.length ? app.go.courses() : app.go.welcome())) : null;
  return {
    el: h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, t('learnWhat')), back), grid),
    onBack: () => { if (canGoBack) (me.started.length ? app.go.courses() : app.go.welcome()); },
  };
}

// Step 3: where to start.
export async function chooseLevelScreen(app, lang) {
  const course = await getCourse(lang);
  const levels = course.levels.filter((l) => l.units > 0);
  const grid = h('div', { class: 'level-grid' });
  levels.forEach((l, i) => {
    grid.appendChild(focusable(h('button', { class: 'level-card', data: i === 0 ? { autofocus: '' } : {} },
      h('b', { class: 'code' }, l.code), h('span', { class: 'small', dir: 'auto' }, pickLang(l.title)), h('span', { class: 'small muted' }, t(`levelHint.${l.id}`))),
    () => { sfx('pick'); app.startCourse(lang, course.levels.findIndex((x) => x.id === l.id)); }));
  });
  const unsure = focusable(h('button', { class: 'btn blue wide' }, '🤔 ', t('notSureLevel')), () => app.go.placement(lang));
  const back = focusable(h('button', { class: 'btn' }, t('back')), () => app.go.learnWhat());
  return {
    el: h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, `${t('whereStart')} · ${pickLang(course.name)}`), back), grid, h('div', { class: 'level-foot' }, unsure)),
    onBack: () => app.go.learnWhat(),
  };
}

// Step 3b: the placement quiz. Every question has "I am not sure".
export async function placementScreen(app, lang) {
  const course = await getCourse(lang);
  const questions = await buildQuiz(lang, course);
  if (questions.length < 4) { toast(t('quizUnavailable')); return chooseLevelScreen(app, lang); }
  const answers = [];
  const root = h('div', { class: 'page quiz' });
  let at = 0;
  const from = app.from;

  function question() {
    clear(root);
    const q = questions[at];
    const item = q.vocab[q.item];
    const bar = h('i', { style: `transform: scaleX(${at / questions.length})` });
    const grid = choiceGrid(q.opts.map((k) => ({ key: k, content: h('span', { dir: 'auto' }, gloss(q.vocab[k], from)) })), {
      isRight: (o) => o.key === q.item,
      onPick: (o, ok) => { sfx(ok ? 'right' : 'wrong'); answers.push(ok ? 'right' : 'wrong'); setTimeout(advance, 650); },
    });
    const unsure = focusable(h('button', { class: 'btn small-btn' }, t('notSure')), () => {
      if (grid.dataset.answered) return;
      grid.dataset.answered = '1';
      sfx('tap');
      answers.push('unsure');
      advance();
    });
    root.append(
      h('div', { class: 'lesson-top' }, h('div', { class: 'bar grow' }, bar), h('span', { class: 'counter' }, `${at + 1}/${questions.length}`)),
      h('h2', { class: 'prompt' }, t('quizPrompt')),
      h('div', { class: 'ex quiz-ex' },
        h('div', { class: 'ex-head' }, speakerButton((slow) => say(item, course.tts, slow)), itemText(item, course, 'big')),
        grid, h('div', null, unsure)));
    setFocus(grid.querySelector('[data-focus]'));
    say(item, course.tts);
  }

  function advance() {
    at++;
    if (at < questions.length) question(); else result();
  }

  function result() {
    clear(root);
    sfx('done');
    const idx = estimateLevel(questions, answers);
    const lvl = course.levels[idx];
    const start = focusable(h('button', { class: 'btn primary wide', data: { autofocus: '' } }, t('startHere', { level: lvl.code })), () => app.startCourse(lang, idx));
    const choose = focusable(h('button', { class: 'btn' }, t('chooseMyself')), () => app.go.chooseLevel(lang));
    root.append(h('div', { class: 'results' }, app.mascot('cheer', 140), h('h1', null, t('yourLevel')),
      h('div', { class: 'card tile-xp' }, h('div', { class: 'big-num' }, lvl.code), h('div', { dir: 'auto' }, pickLang(lvl.title))),
      h('div', { class: 'row-gap' }, start, choose)));
    setFocus(start);
  }

  return { el: root, mounted: question, onBack: () => app.go.chooseLevel(lang) };
}

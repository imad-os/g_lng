// Entry point: My PC lifecycle, boot, and navigation between screens.
import { ensureIdentity } from './data/league.js?v=2.6.0';
import { readConfig } from './config.js?v=2.6.0';
import { setUiLang, uiLang, t, UI_LANGS } from './platform/i18n.js?v=2.6.0';
import { initScreen, destroyScreen } from './platform/screen.js?v=2.6.0';
import { handleAction } from './platform/input.js?v=2.6.0';
import { configureAudio, startAudio, pauseAudio, resumeAudio, destroyAudio, setVolume, stopVoice, setExternalSpeech } from './platform/audio.js?v=2.6.0';
import { openContent, getCourse, getLesson, getUnit, getLexicon, flushContentCache } from './data/content-repo.js?v=2.6.0';
import { openProgress, getMe, saveMe, saveCourse, course as progressOf } from './data/progress-store.js?v=2.6.0';
import { buildReview } from './learning/review.js?v=2.6.0';
import { initRouter, show, menuChosen } from './ui/router.js?v=2.6.0';
import { initComponents, initAiBadge, openDialog, toast } from './ui/components.js?v=2.6.0';
import { mascot } from './ui/mascot.js?v=2.6.0';
import { h } from './platform/dom.js?v=2.6.0';
import { coursesScreen } from './ui/screens/courses.js?v=2.6.0';
import { speakScreen, learnWhatScreen, chooseLevelScreen, placementScreen } from './ui/screens/welcome.js?v=2.6.0';
import { homeScreen } from './ui/screens/home.js?v=2.6.0';
import { lessonScreen } from './ui/screens/lesson.js?v=2.6.0';
import { resultsScreen } from './ui/screens/results.js?v=2.6.0';
import { statsScreen } from './ui/screens/stats.js?v=2.6.0';
import { settingsScreen } from './ui/screens/settings.js?v=2.6.0';
import { blitzScreen } from './ui/screens/blitz.js?v=2.6.0';
import { setAppAiConfig } from './ai/config.js?v=2.6.0';
import { chatScreen } from './ui/screens/chat.js?v=2.6.0';
import { adminScreen } from './ui/screens/admin.js?v=2.6.0';
import { aiReady } from './ai/config.js?v=2.6.0';
import { explainExercise, explainUnit, customLesson } from './ai/tasks.js?v=2.6.0';
import { externalTtsEnabled, externalSpeak, stopExternalSpeech } from './ai/speech.js?v=2.6.0';

const MyPC = window.MyPC;

// Everything screens need, in one place.
const app = {
  MyPC,
  config: null,
  catalog: null,
  lang: null,          // course being learned
  from: 'en',          // language translations are shown in
  courseDoc: null,
  mascot,
  getUnit: (id) => getUnit(app.lang, id),
  // Optional AI helpers (they need the user's own key, set in Admin).
  ai: {
    ready: () => aiReady(),
    explainExercise: (lesson, ex) => explainExercise({ course: app.courseDoc, ex, vocab: lesson.vocab, from: app.from }),
    async explainUnit(unitId) {
      const [unit, lex] = await Promise.all([getUnit(app.lang, unitId), getLexicon(app.lang, unitId)]);
      const words = lex ? Object.values(lex.words).map((v) => ({ t: v.t, tr: v.tr, g: v.g })) : [];
      return explainUnit({ course: app.courseDoc, unit, words, from: app.from });
    },
  },
  go: {
    home: () => show(homeScreen(app)),
    courses: () => show(coursesScreen(app)),
    welcome: () => show(speakScreen(app)),
    learnWhat: () => show(learnWhatScreen(app, { canGoBack: true })),
    chooseLevel: (lang) => guard(async () => show(await chooseLevelScreen(app, lang))),
    placement: (lang) => guard(async () => show(await placementScreen(app, lang))),
    stats: () => show(statsScreen(app)),
    settings: () => show(settingsScreen(app)),
    admin: () => show(adminScreen(app)),
    chat: () => show(chatScreen(app)),
    blitz: () => show(blitzScreen(app)),
    results: (lesson, result) => show(resultsScreen(app, lesson, result)),
    play: (lesson) => show(lessonScreen(app, lesson)),
    pickCourse: (id) => guard(async () => {
      const entry = app.catalog.courses.find((c) => c.id === id);
      if (!entry || !entry.ready || !entry.ready.length) { toast(t('comingSoon')); return; }
      await useCourse(id);
      app.go.home();
    }),
    lesson: (id) => guard(async () => {
      const lesson = await getLesson(app.lang, id);
      if (!lesson) throw new Error('Missing lesson ' + id);
      show(lessonScreen(app, lesson));
    }),
    review: () => guard(async () => {
      const lesson = await buildReview(app.lang);
      if (!lesson) { openDialog({ title: t('reviewEmptyTitle'), text: t('reviewEmptyText'), buttons: [{ label: t('close'), kind: 'primary' }] }); return; }
      show(lessonScreen(app, lesson));
    }),
    aiLesson: (theme) => guard(async () => {
      toast(t('thinking'), 6000);
      show(lessonScreen(app, await customLesson({ course: app.courseDoc, from: app.from, theme })));
    }),
  },
  // Begin (or continue) a course at a chosen level.
  startCourse: (lang, levelIndex) => guard(async () => {
    await useCourse(lang);
    const p = progressOf(lang);
    const level = app.courseDoc.levels[levelIndex] || app.courseDoc.levels[0];
    p.c.level = level.id;
    p.c.placed = Math.max(p.c.placed || 0, levelIndex);
    saveCourse(lang);
    app.go.home();
  }),
};

async function useCourse(id) {
  const me = getMe();
  app.courseDoc = await getCourse(id);
  app.lang = id;
  if (me.from === id || !UI_LANGS.includes(me.from)) me.from = UI_LANGS.find((l) => l !== id && l === uiLang()) || UI_LANGS.find((l) => l !== id);
  app.from = me.from;
  me.course = id;
  saveCourse(id);          // registers the course in "my languages"
}

async function guard(fn) {
  try { await fn(); } catch (e) {
    console.error(e);
    openDialog({ title: t('loadFailed'), text: e && e.message && !/fetch|network/i.test(e.message) ? e.message : '', buttons: [{ label: t('close'), kind: 'primary' }] });
  }
}

MyPC.init({
  async onInit(info) {
    const me = openProgress(MyPC, info.lang);
    ensureIdentity(me, info.profile && info.profile.name);
    // The language the learner speaks comes from My PC (info.lang). The picker is only shown when it is not one of ours.
    app.sysLang = UI_LANGS.includes(info.lang) ? info.lang : null;
    if (!UI_LANGS.includes(me.from)) me.from = app.sysLang || '';
    setUiLang(UI_LANGS.includes(me.ui) ? me.ui : (app.sysLang || 'en'));
    if (info.quality && info.quality.tier === 'low') document.body.classList.add('low');
    initScreen(document.getElementById('stage'));
    initRouter(document.getElementById('screen'), MyPC);
    initComponents(document.getElementById('layer'));
    initAiBadge();
    app.config = readConfig(MyPC.app_config);
    setAppAiConfig(MyPC.app_config);
    configureAudio({ base: app.config.audioBase, speech: app.config.speech && me.speech, vol: info.volume, sfx: me.sfx });
    setExternalSpeech((text, lang) => (externalTtsEnabled() ? externalSpeak(text, lang) : Promise.resolve(false)), stopExternalSpeech);
    document.getElementById('screen').appendChild(h('div', { class: 'boot' }, t('loading')));
    try {
      MyPC.progress(0.2);
      app.catalog = await openContent(app.config);
      MyPC.progress(0.6);
      const saved = app.catalog.courses.find((c) => c.id === me.course && c.ready && c.ready.length);
      if (saved) await useCourse(saved.id);
      MyPC.progress(1);
      MyPC.ready();
    } catch (e) {
      console.error(e);
      MyPC.fail(t('loadFailed'));
    }
  },
  onStart() {
    startAudio();
    const me = getMe();
    if (app.lang) app.go.home();
    else if (me.started.length) app.go.courses();
    else if (app.sysLang) { me.from = app.sysLang; app.go.learnWhat(); }
    else app.go.welcome();
  },
  onPause() { pauseAudio(); },
  onResume() { resumeAudio(); },
  onDestroy() {
    stopVoice();
    destroyAudio();
    destroyScreen();
    flushContentCache();
  },
  onInput(action, pressed) { handleAction(action, pressed); },
  onMenu(id) { menuChosen(id); },
  onVolume(v) { setVolume(v); },
});

// Entry point: My PC lifecycle, boot, and navigation between screens.
import { readConfig } from './config.js?v=2.1.0';
import { setUiLang, uiLang, t, UI_LANGS } from './platform/i18n.js?v=2.1.0';
import { initScreen, destroyScreen } from './platform/screen.js?v=2.1.0';
import { handleAction } from './platform/input.js?v=2.1.0';
import { configureAudio, startAudio, pauseAudio, resumeAudio, destroyAudio, setVolume, stopVoice } from './platform/audio.js?v=2.1.0';
import { openContent, getCourse, getLesson, getUnit, flushContentCache } from './data/content-repo.js?v=2.1.0';
import { openProgress, getMe, saveMe } from './data/progress-store.js?v=2.1.0';
import { buildReview } from './learning/review.js?v=2.1.0';
import { initRouter, show, menuChosen } from './ui/router.js?v=2.1.0';
import { initComponents, openDialog, toast } from './ui/components.js?v=2.1.0';
import { h } from './platform/dom.js?v=2.1.0';
import { coursesScreen } from './ui/screens/courses.js?v=2.1.0';
import { homeScreen } from './ui/screens/home.js?v=2.1.0';
import { lessonScreen } from './ui/screens/lesson.js?v=2.1.0';
import { resultsScreen } from './ui/screens/results.js?v=2.1.0';
import { statsScreen } from './ui/screens/stats.js?v=2.1.0';
import { settingsScreen } from './ui/screens/settings.js?v=2.1.0';

const MyPC = window.MyPC;

// Everything screens need, in one place.
const app = {
  MyPC,
  config: null,
  catalog: null,
  lang: null,          // course being learned
  from: 'en',          // language translations are shown in
  courseDoc: null,
  getUnit: (id) => getUnit(app.lang, id),
  go: {
    home: () => show(homeScreen(app)),
    courses: () => show(coursesScreen(app)),
    stats: () => show(statsScreen(app)),
    settings: () => show(settingsScreen(app)),
    results: (lesson, result) => show(resultsScreen(app, lesson, result)),
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
  },
};

async function useCourse(id) {
  const me = getMe();
  app.courseDoc = await getCourse(id);
  app.lang = id;
  if (me.from === id || !UI_LANGS.includes(me.from)) me.from = UI_LANGS.find((l) => l !== id && l === uiLang()) || UI_LANGS.find((l) => l !== id);
  app.from = me.from;
  me.course = id;
  saveMe();
}

async function guard(fn) {
  try { await fn(); } catch (e) {
    console.error(e);
    openDialog({ title: t('loadFailed'), text: '', buttons: [{ label: t('close'), kind: 'primary' }] });
  }
}

MyPC.init({
  async onInit(info) {
    setUiLang(info.lang);
    if (info.quality && info.quality.tier === 'low') document.body.classList.add('low');
    initScreen(document.getElementById('stage'));
    initRouter(document.getElementById('screen'), MyPC);
    initComponents(document.getElementById('layer'));
    app.config = readConfig(MyPC.app_config);
    const me = openProgress(MyPC, info.lang);
    configureAudio({ base: app.config.audioBase, speech: app.config.speech && me.speech, vol: info.volume });
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
    if (app.lang) app.go.home(); else app.go.courses();
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

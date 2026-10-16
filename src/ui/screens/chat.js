// Chat practice (optional AI): talk to a model in the language you learn. Type with a keyboard or speak into the mic;
// the model keeps to the level of the course and writes "Fix: ..." when there is a mistake.
import { h, focusable, clear } from '../../platform/dom.js?v=2.5.3';
import { t } from '../../platform/i18n.js?v=2.5.3';
import { setFocus } from '../../platform/input.js?v=2.5.3';
import { say } from '../../platform/audio.js?v=2.5.3';
import { course as progressOf } from '../../data/progress-store.js?v=2.5.3';
import { chatTurn } from '../../ai/tasks.js?v=2.5.3';
import { sttAvailable, listenOnce } from '../../ai/speech.js?v=2.5.3';
import { toast } from '../components.js?v=2.5.3';

const MAX_TURNS = 12;     // keeps the request small; older turns are dropped

export function chatScreen(app) {
  const course = app.courseDoc;
  const level = (progressOf(app.lang).c.level || 'b1').toUpperCase();
  const history = [];
  const log = h('div', { class: 'chat-log' });
  const input = h('input', { class: 'type-input', type: 'text', autocomplete: 'off', spellcheck: 'false', lang: course.id, dir: 'auto', placeholder: t('typeHere'), maxlength: '200' });
  let busy = false, gone = false;
  const ctl = new AbortController();

  const bubble = (role, text) => {
    const el = h('div', { class: `bubble ${role}`, dir: 'auto' }, text);
    if (role === 'bot') {
      const target = text.split('\n')[0].replace(/^Fix:.*$/i, '').trim() || text;
      el.appendChild(focusable(h('button', { class: 'chip icon-chip', 'aria-label': t('listen') }, '🔊'), () => say({ t: target.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim() }, course.tts)));
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  async function turn() {
    busy = true;
    const wait = bubble('bot', t('thinking'));
    try {
      const reply = await chatTurn({ course, from: app.from, level, history: history.slice(-MAX_TURNS), signal: ctl.signal });
      if (gone) return;
      history.push({ role: 'assistant', content: reply });
      wait.remove();
      bubble('bot', reply);
    } catch (e) {
      if (gone) return;
      wait.remove();
      toast(e.message || t('loadFailed'));
      if (history.length && history[history.length - 1].role === 'user') history.pop();   // let the learner resend
    }
    busy = false;
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    history.push({ role: 'user', content: text });
    bubble('me', text);
    input.value = '';
    turn();
  }

  // A text field needs real keys: keep them away from the SDK's key mapping (same as the typing exercise).
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); send(input.value); }
  };
  const field = focusable(h('div', { class: 'type-field grow' }, input), () => input.focus());
  const sendBtn = focusable(h('button', { class: 'btn primary' }, t('chatSend')), () => send(input.value));
  const mic = sttAvailable() ? focusable(h('button', { class: 'btn blue' }, '🎤'), async () => {
    if (busy) return;
    toast(t('listening'));
    try { send(await listenOnce(course.tts)); } catch (e) { toast(t('micBlocked')); }
  }) : null;
  const back = focusable(h('button', { class: 'btn small-btn', 'aria-label': t('back') }, '✕'), () => app.go.home());

  const root = h('div', { class: 'chat' },
    h('div', { class: 'chat-head' }, back, h('h2', null, '💬 ', t('chatTitle'), ' · ', course.native)),
    log,
    h('div', { class: 'chat-foot' }, field, mic, sendBtn));

  turn();
  setTimeout(() => setFocus(field), 0);
  return { el: root, onBack: () => { gone = true; ctl.abort(); app.go.home(); } };
}

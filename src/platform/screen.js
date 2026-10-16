// Scales the fixed 1280x720 stage to fill the window (letterboxed, centred).
export const W = 1280, H = 720;
let stage = null;

export function fitStage() {
  if (!stage) return;
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const x = (window.innerWidth - W * s) / 2, y = (window.innerHeight - H * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

export function initScreen(el) {
  stage = el;
  fitStage();
  window.addEventListener('resize', fitStage);
}

export function destroyScreen() { window.removeEventListener('resize', fitStage); }

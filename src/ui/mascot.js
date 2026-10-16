// Coach Ziryab, a small owl drawn in SVG. Moods change the eyes, brows and beak; CSS animates the cheer.
import { h } from '../platform/dom.js?v=2.4.0';

const EYES = {
  happy: '<circle cx="42" cy="46" r="9" fill="#1b2a41"/><circle cx="78" cy="46" r="9" fill="#1b2a41"/><circle cx="45" cy="43" r="3" fill="#fff"/><circle cx="81" cy="43" r="3" fill="#fff"/>',
  cheer: '<path d="M33 48q9-14 18 0M69 48q9-14 18 0" stroke="#1b2a41" stroke-width="5" fill="none" stroke-linecap="round"/>',
  sad: '<circle cx="42" cy="48" r="9" fill="#1b2a41"/><circle cx="78" cy="48" r="9" fill="#1b2a41"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="81" cy="45" r="3" fill="#fff"/><path d="M30 34l22 6M90 34l-22 6" stroke="#1b2a41" stroke-width="4" stroke-linecap="round"/>',
  think: '<circle cx="46" cy="46" r="9" fill="#1b2a41"/><circle cx="82" cy="46" r="9" fill="#1b2a41"/><circle cx="49" cy="43" r="3" fill="#fff"/><circle cx="85" cy="43" r="3" fill="#fff"/>',
};
const BEAK = {
  happy: '<path d="M54 60l6 9 6-9z" fill="#ffc800"/>',
  cheer: '<path d="M52 60h16l-8 14z" fill="#ffc800"/>',
  sad: '<path d="M54 66l6-6 6 6z" fill="#ffc800"/>',
  think: '<path d="M54 60l6 9 6-9z" fill="#ffc800"/>',
};
const WINGS = {
  cheer: '<path d="M16 70Q2 40 10 22 26 40 28 66z" fill="#1ea0d8"/><path d="M104 70Q118 40 110 22 94 40 92 66z" fill="#1ea0d8"/>',
  default: '<path d="M18 76Q6 66 12 48 24 60 28 74z" fill="#1ea0d8"/><path d="M102 76Q114 66 108 48 96 60 92 74z" fill="#1ea0d8"/>',
};

// mood: 'happy' | 'cheer' | 'sad' | 'think'; size in px.
export function mascot(mood = 'happy', size = 96) {
  const m = EYES[mood] ? mood : 'happy';
  return h('span', {
    class: `mascot ${m}`, style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true',
    html: `<svg viewBox="0 0 120 120" width="${size}" height="${size}">
      ${m === 'cheer' ? WINGS.cheer : WINGS.default}
      <ellipse cx="60" cy="72" rx="38" ry="40" fill="#2bb3ec"/>
      <ellipse cx="60" cy="86" rx="24" ry="24" fill="#a7e4fb"/>
      <path d="M26 40l-6-22 20 12zM94 40l6-22-20 12z" fill="#2bb3ec"/>
      <circle cx="42" cy="46" r="17" fill="#fff"/><circle cx="78" cy="46" r="17" fill="#fff"/>
      ${EYES[m]}${BEAK[m]}
      <path d="M44 108l-6 8h16zM76 108l6 8H66z" fill="#ffc800"/>
    </svg>`,
  });
}

// How forgiving typed and spoken answers are: the same word with other case, accents, punctuation, spacing or an
// Arabic spelling variant is right, and one slip in a long word is too. A different word is still wrong.

const FOLD = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ı: 'i' };

export function normalize(s) {
  let x = String(s == null ? '' : s).normalize('NFKD').toLowerCase();
  x = x.replace(/[ßæœøđðþłı]/g, (c) => FOLD[c]);
  x = x.replace(/[̀-ͯ]/g, '');                        // Latin accents: ñ -> n, é -> e, ü -> u
  x = x.replace(/[ً-ٰٟۖ-ۭـ]/g, ''); // Arabic harakat and tatweel
  x = x.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي').replace(/ء/g, '');
  x = x.replace(/[’‘ʼ`´']/g, '');                              // l'eau, l’eau and leau are the same
  x = x.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return x;
}

export function distance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1);   // swapped letters
    }
    prev = cur;
  }
  return prev[b.length];
}

// Slips allowed in a word or phrase of this length: none for short ones (casa and caso differ), one from 6 letters, two from 14.
const slips = (len) => (len >= 14 ? 2 : len >= 6 ? 1 : 0);

export function sameAnswer(typed, target) {
  const a = normalize(typed), b = normalize(target);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.replace(/ /g, '') === b.replace(/ /g, '')) return true;   // spaces in the wrong place
  const words = (s) => s.split(' ');
  if (words(a).length !== words(b).length) return false;
  return distance(a, b, 2) <= slips(b.length);
}

// Spoken answer: enough of the target's words were heard (a word counts with one slip when it is long enough).
export function heardEnough(heard, target, ratio = 0.6) {
  const want = normalize(target).split(' ').filter(Boolean);
  const got = normalize(heard).split(' ').filter(Boolean);
  if (!want.length) return false;
  const hit = want.filter((w) => got.some((g) => g === w || (w.length >= 5 && distance(g, w, 1) <= 1))).length;
  return hit / want.length >= ratio;
}

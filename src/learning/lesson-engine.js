// Runs one lesson: the exercise queue, retries of mistakes at the end, and the result.
export class LessonRun {
  constructor(lesson, { canHear }) {
    this.lesson = lesson;
    this.queue = lesson.ex.map((e) => (e.type === 'listen_pick' && !canHear ? { ...e, type: 'pick_target' } : e));
    this.total = this.queue.length;
    this.pos = 0;
    this.firstTry = new Map();    // exercise id -> right on the first try
    this.words = new Map();       // word key -> every answer right so far
    this.mistakes = [];
    this.typeStats = {};          // type -> [attempts, right]
  }

  get current() { return this.queue[this.pos] || null; }
  get done() { return this.pos >= this.queue.length; }
  get progress() { return Math.min(1, this.firstTry.size / this.total); }

  // detail.words: word keys this answer says something about (see exercise modules).
  answer(correct, detail = {}) {
    const e = this.current;
    if (!this.firstTry.has(e.id)) {
      this.firstTry.set(e.id, correct);
      const s = this.typeStats[e.type] || (this.typeStats[e.type] = [0, 0]);
      s[0]++; if (correct) s[1]++;
    }
    for (const k of detail.words || []) {
      const ok = detail.wrongWords ? !detail.wrongWords.includes(k) : correct;
      this.words.set(k, (this.words.has(k) ? this.words.get(k) : true) && ok);
    }
    if (!correct) {
      this.mistakes.push({ id: e.id, picked: detail.picked || '' });
      if (!e.retry) this.queue.push({ ...e, retry: true });
    }
  }

  next() { this.pos++; }

  result() {
    let right = 0;
    for (const v of this.firstTry.values()) if (v) right++;
    return { firstTryRight: right, total: this.total, accuracy: this.total ? right / this.total : 1, mistakes: this.mistakes };
  }
}

// Word keys that an exercise checks (sentences are not tracked word by word).
export function wordsOf(e, vocab) {
  const keys = e.type === 'match_pairs' ? e.items : [e.item];
  return keys.filter((k) => vocab[k] && vocab[k].k === 'w');
}

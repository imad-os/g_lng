// Which lessons and levels are open, and what comes next on the home path.
export function lessonOrder(level) {
  const out = [];
  for (const u of level.units) for (const l of u.lessons) out.push({ unit: u, lesson: l });
  return out;
}

export function levelComplete(level, done) {
  const list = lessonOrder(level);
  return list.length > 0 && list.every((x) => done[x.lesson.id]);
}

// A lesson is open when it is the first of the level or the one before it is done.
export function lessonState(level, lessonId, done) {
  if (done[lessonId]) return 'done';
  const list = lessonOrder(level);
  const i = list.findIndex((x) => x.lesson.id === lessonId);
  if (i <= 0) return 'open';
  return done[list[i - 1].lesson.id] ? 'open' : 'locked';
}

export function nextLesson(level, done) {
  return lessonOrder(level).find((x) => !done[x.lesson.id]) || null;
}

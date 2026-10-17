// 观察规则：同一个对象，不同人物读到不同的笔记、在不同距离上看得清。
// entry 可以是 species（动物）或 clue（自然线索），二者都有 notes。

// 动物对所有人可见；线索只有 notes 里含有人物 focus 的人才会察觉。
export function perceives(entry, character) {
  return character.focus.some((focus) => entry.notes[focus]);
}

// 人物的专长：动物看 affinity，线索看能否察觉。
export function isSpecialty(entry, character) {
  const tags = entry.affinity ?? Object.keys(entry.notes);
  return character.focus.some((focus) => tags.includes(focus));
}

export function noteFor(entry, character, state) {
  const focus = character.focus.find((f) => entry.notes[f]);
  const text = focus ? entry.notes[focus] : entry.notes.common;
  if (!text) return null;
  const extra = state && entry.stateNotes?.[state];
  return { text: extra ? `${text}${extra}` : text, focus: focus ?? null };
}

// 能看清的最远水平距离（米）。超过 8 米的部分受远视力影响。
export function observeRange(entry, character, { binoculars = false } = {}) {
  const { focusRange, farSight } = character.traits;
  let range =
    (entry.observeRange ?? entry.range) *
    (isSpecialty(entry, character) ? focusRange : 1) *
    (binoculars ? 6 : 1);
  if (range > 8) range = 8 + (range - 8) * farSight;
  return range;
}

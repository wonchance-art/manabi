// 강의 콘텐츠 코드 소스 — DB(reading_materials)의 lesson_explanation_ko / conversation_script보다 우선.
// 한 강의를 코드로 옮기려면: 파일 추가 → 아래 LESSONS에 import.

import n5_01_desu from './n5-01-desu';

const LESSONS = [
  n5_01_desu,
];

const BY_ID = new Map(LESSONS.map(l => [Number(l.id), l]));

export function getLessonContent(id) {
  if (id == null) return null;
  return BY_ID.get(Number(id)) || null;
}

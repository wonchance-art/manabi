// 서버 전용 — 수업 코스 페이로드. 교재 문장 파일(nihongo42Class)을 import하는 곳은 여기뿐이다
// (클라이언트 번들에 실리면 팀 암호가 무의미해진다 — classCourse.test.js가 지킨다).
import nihongo42 from '../../content/community/nihongo42.js';
import nihongo42Class from '../../content/community/nihongo42Class.js';
import { buildCoursePayload, courseInfo } from '../classCourse.js';

const SOURCES = { nihongo42: { base: nihongo42, cls: nihongo42Class } };

/** 코스 키 → 화면 페이로드. 등록되지 않은 키는 null. */
export function loadCourse(key) {
  const source = courseInfo(key) ? SOURCES[key] : null;
  return source ? buildCoursePayload(source.base, source.cls) : null;
}

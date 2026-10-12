// 관리자 사전 편집(PATCH /api/admin/dictionary)의 뜻 정규화 — 순수 모듈(MEANING-VERIFY-001).
//
// 왜: 편집이 meanings를 {meaning, priority}로 다시 만들면서 뜻별 pos·영어 판정 marker(en_pos_v)·중국어 일본어 대응(ja)을
// 지웠다. 뜻별 pos가 사라지면 겸류 뜻 정렬(pickZhMeaning·영어 문맥 뜻)이 첫 뜻으로 떨어지고, 관리자가 고친 행은
// user_verified라 자가 치유(백필)도 다시 채우지 않는다 — 고치려다 다른 정보를 영구히 잃는 구조였다.
//
// 규칙:
//  - 요청 뜻에 pos가 있으면 그 언어 정본(posCanon)일 때만 싣는다(X 게이트 — 정본 밖 문자열이 승격되지 않게).
//  - 요청 뜻에 en_pos_v가 1이면 싣는다(다른 값은 버린다).
//  - 요청 뜻에 그 필드가 없고 기존 행에 같은 뜻 글자가 있으면 기존 값(pos·en_pos_v·ja)을 이어받는다.
//    뜻 글자를 바꾼 항목은 이어받지 않는다(다른 뜻의 품사를 붙이지 않는다).
import { isCanonPos } from './posCanon';

const MAX_MEANINGS = 5;

/**
 * @param {Array<object>} input - 요청 updates.meanings
 * @param {{ language?: string, previous?: Array<object> }} [ctx] - 기존 행의 언어·meanings
 * @returns {Array<{meaning:string, priority:number, pos?:string, en_pos_v?:1, ja?:object|null}>}
 */
export function normalizeAdminMeanings(input, { language = null, previous = [] } = {}) {
  const prevByText = new Map();
  for (const m of Array.isArray(previous) ? previous : []) {
    const text = typeof m?.meaning === 'string' ? m.meaning : null;
    if (text && !prevByText.has(text)) prevByText.set(text, m);
  }
  return (Array.isArray(input) ? input : [])
    .filter((m) => m?.meaning)
    .slice(0, MAX_MEANINGS)
    .map((m, i) => {
      const meaning = String(m.meaning).slice(0, 200);
      const out = { meaning, priority: i + 1 };
      const prev = prevByText.get(meaning);
      if (typeof m.pos === 'string' && m.pos.trim()) {
        if (isCanonPos(language, m.pos)) out.pos = m.pos.trim().slice(0, 20);
      } else if (prev && typeof prev.pos === 'string' && isCanonPos(language, prev.pos)) {
        out.pos = prev.pos;
      }
      if (m.en_pos_v === 1) out.en_pos_v = 1;
      else if (m.en_pos_v === undefined && prev?.en_pos_v === 1) out.en_pos_v = 1;
      if (prev && 'ja' in prev && !('ja' in m)) out.ja = prev.ja;
      return out;
    });
}

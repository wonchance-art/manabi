// 뜻 정리 — 의존성 없는 작은 모듈. /vocab(VocabPage)이 이 함수 하나 때문에 studySession(18.5KB) 전체를 싣던 것을 끊는다
// (2026-10-17 KST 번들 조사). studySession이 다시 내보낸다.
/**
 * 뜻 문자열에서 원어 병기 괄호 제거 — 보기 텍스트 정화.
 * user_vocabulary.meaning에 "일하다 (働く)"처럼 원어(가나·한자·라틴)를 병기해 저장한 데이터가
 * 4지선다 보기에 그대로 나오면 정답이 시각적으로 새므로, 사용 시점에 정리한다.
 * 판정: 괄호(반각 `()`·전각 `（）`) 안에 한글이 하나라도 있으면 보존("달리다 (과거형)"),
 *       없고 가나/한자/라틴문자가 있으면 원어 병기로 보고 괄호째 제거. 그 외(숫자·기호)는 보존.
 * 순수 함수·멱등. 남은 공백은 정리해 trim.
 */
const MEANING_HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const MEANING_SOURCE_SCRIPT = /[ぁ-ゟゔァ-ヿーｦ-ﾟ々〆〤ヶ一-鿿a-zA-Z]/; // 가나·장음·반각가나·한자·라틴
export function stripSourceLangInMeaning(meaning) {
  if (typeof meaning !== 'string' || !meaning) return meaning;
  const out = meaning.replace(/\s*[（(]\s*([^（()）]*?)\s*[)）]/g, (m, inner) => {
    if (MEANING_HANGUL.test(inner)) return m;          // 한글 설명 괄호 → 보존
    if (MEANING_SOURCE_SCRIPT.test(inner)) return '';  // 원어(가나·한자·라틴)만 → 제거
    return m;                                          // 숫자·기호 등 → 보존
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

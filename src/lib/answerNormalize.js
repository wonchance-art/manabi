/**
 * 채점 입력 정규화 정본 (v2-M 입력 관용성, #1077 — 오너 확정 2026-08-30).
 * 흩어져 있던 3종(studySession·ExerciseEngine·dictation)을 이 한 본으로 수렴한다 —
 * 경로별 재구현 금지(answerNormalize 계약 테스트가 강제).
 *
 * 두 정책 = 설계 §2 표의 두 행:
 * - normalizeAnswer(철자 모드): 받아쓰기 — 악상·성조는 철자이므로 보존(fold 옵션은
 *   '악상만 다름' 판별 전용). 공백은 낱말 경계라 1칸으로 유지.
 * - normalizeRecall(인출 모드): 어휘 타이핑·cloze·문법 드릴 — 목적이 인출이지 철자
 *   정밀도가 아니다(prefere=préfère, hanyu=hànyǔ). 폴딩 + 공백 전부 제거 +
 *   하이픈·« » 추가 관용.
 *
 * 폴딩 급소(설계 §1): 결합 부호 제거는 선행 문자가 라틴일 때만 — 무차별 NFD 폴딩은
 * が(か+U+3099)를 か로 만든다(탁점은 별개 음소). U+3099/309A는 제거 범위(U+0300–036F)
 * 밖이고, 라틴 선행 가드가 이를 이중으로 봉한다.
 */

// 철자 모드 무시 구두점 — 기존 dictation의 채점 무시 셋 그대로(받아쓰기 동작 불변).
const PUNCT_SPELLING = /[。、！？!?.,·…‥「」『』“”"'’‘:;，．（）()[\]—–~〜]/g;
// 인출 모드 추가 관용 — 하이픈(peut-être)·프랑스 인용부호(드릴 loose 셋 승계).
const PUNCT_RECALL_EXTRA = /[«»-]/g;

const foldLatinDiacritics = (s) => s
  .normalize('NFD')
  .replace(/([A-Za-z])[\u0300-\u036F]+/g, '$1')
  .normalize('NFC');

/**
 * 철자 모드 — NFC → trim → 공백 1칸 → 구두점 제거 → (fold) → 소문자.
 * lang은 시그니처 예약(설계 §2): 현재 정책은 언어 무관 — 소문자화는 CJK에 무해하고
 * 폴딩 가드는 문자 단위(라틴 선행)라 언어 판단이 필요 없다.
 */
export function normalizeAnswer(text, lang, { foldDiacritics = false } = {}) {
  let s = String(text || '').normalize('NFC').trim().replace(/[\s　]+/g, ' ');
  s = s.replace(PUNCT_SPELLING, '');
  if (foldDiacritics) s = foldLatinDiacritics(s);
  return s.toLowerCase();
}

/** 인출 모드 — 철자 모드 + 폴딩 + 공백 전부 제거 + 추가 구두점 관용. */
export function normalizeRecall(text, lang) {
  return normalizeAnswer(text, lang, { foldDiacritics: true })
    .replace(PUNCT_RECALL_EXTRA, '')
    .replace(/[\s　]+/g, '');
}

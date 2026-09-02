import { isCanonPos } from './posCanon';
// 서버 전용 — 교정의 사전 승격(링큐식 "이 단어 전체에 적용", 오너 승인 보완 ②).
// 오너가 확정한 뜻·발음·품사를 공유 사전(morpheme_dictionary)에 source='user_verified'로
// 반영해, 이후 모든 자료 분석이 교정을 따르게 한다. 자가 치유·뜻 재조회·pos 기록 로직은
// user_verified 행을 덮지 않도록 이미 설계돼 있다(needsZhMeaningPosRefresh·buildZhPosWriteback).

/**
 * 승격 행 구성(순수 함수) — 교정 뜻은 선두(priority 1)로, 기존 뜻은 중복 제거 후 뒤로.
 * 교정 pos는 기존 다중 후보('·')의 선두로 합류. reading은 교정 발음 우선.
 * @param {object|null} existing - 기존 사전 행(meanings·reading·pos) 또는 null(미등재)
 * @param {{meaning?: string, furigana?: string, pos?: string}} corrections
 * @returns {{pos, reading, meanings, source}|null} meanings가 비면 null(승격 불가 — 뜻 없는 행 방지)
 */
export function buildPromotedEntry(existing, correctionsIn, language) {
  // X 게이트: 정본 밖 pos는 무시하고 뜻·발음 승격은 진행(pos는 기존값 유지). language가 없으면(구 호출)
  // 판정하지 않는다 — 라우트는 항상 language를 넘긴다(계약).
  const corrections = language && correctionsIn?.pos && !isCanonPos(language, correctionsIn.pos)
    ? { ...correctionsIn, pos: undefined }
    : (correctionsIn || {});
  const prior = Array.isArray(existing?.meanings)
    ? existing.meanings.filter((m) => m && typeof m.meaning === 'string' && m.meaning.trim())
    : [];

  let meanings = prior;
  if (corrections.meaning && String(corrections.meaning).trim()) {
    const head = {
      meaning: String(corrections.meaning).trim().slice(0, 80),
      priority: 1,
      ...(corrections.pos ? { pos: String(corrections.pos).trim().slice(0, 20) } : {}),
    };
    meanings = [
      head,
      ...prior
        .filter((m) => m.meaning !== head.meaning)
        .map((m, i) => ({ ...m, priority: i + 2 })),
    ].slice(0, 3);
  }
  if (meanings.length === 0) return null; // 뜻이 전혀 없으면 사전 행이 성립하지 않는다

  const reading = corrections.furigana && String(corrections.furigana).trim()
    ? String(corrections.furigana).trim().slice(0, 120)
    : (existing?.reading ?? null);

  let pos = existing?.pos ?? null;
  if (corrections.pos && String(corrections.pos).trim()) {
    const posNew = String(corrections.pos).trim().slice(0, 20);
    const rest = String(pos || '').split('·').map((s) => s.trim()).filter((p) => p && p !== posNew);
    pos = [posNew, ...rest].join('·').slice(0, 30);
  }

  return { pos, reading, meanings, source: 'user_verified' };
}

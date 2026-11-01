// 뷰어 v2 AD-R3 단어 경계 편집의 진입 판정 · 이유 문구 · 오류 형(VIEWER-JS-001) — 화면이 첫 렌더부터 동기로 묻는 것만 여기 둔다.
// 판정 · 쓰기 흐름(plan · commit · undo …)은 boundaryEditFlow.js이고, 뷰어는 그 모듈을 이 자료 소유자에게만 첫 렌더 뒤에 받는다
// (첫 로드 page 청크에서 뺀다 — 손님 · 다른 사람 자료의 독자는 받지 않는다). boundaryEditFlow가 여기 것을 그대로 다시 내보낸다.
// 정본: docs/manabi-viewer-v2-ad-r3.md §6.1(조건) · §7.5(한국어 B안).
import { BOUNDARY_LANGUAGES, BOUNDARY_LIMITS } from './boundaryEdits';
import { koreanSplitRecordOf } from './koreanBoundarySplit';

/** 화면 판정에 넘길 문맥(§6.1 · §4.4 · Q4 · §12.2). 수업 사본 = 팀 수업이 만든 사본(source_ref) 또는 기기 사본(__local). */
export function boundaryEditContext(material, { userId, classMode = false, passage = false } = {}) {
  const meta = material?.processed_json?.metadata || {};
  return {
    language: meta.language,
    owner: !!userId && userId === material?.owner_id,
    classCopy: !!meta.source_ref || !!material?.__local,
    passage: !!passage,
    classMode: !!classMode,
  };
}

/** 진입점(드래그 「한 단어로 묶기」 · ⋯ 「옆 단어와 묶기」·「나누기」 · 카드 [나누기])을 보일 수 있나. 비소유자·한국어·사본·구간·수업 모드는 0. */
export function boundaryEntryAllowed(ctx) {
  return !!ctx && ctx.owner === true && BOUNDARY_LANGUAGES.includes(ctx.language)
    && !ctx.classCopy && !ctx.passage && !ctx.classMode;
}

// 진입점을 숨기는 이유(보일 문구 없음) — 나머지는 버튼을 끄고 이유를 쓴다(§6.1 「숨기지 않고 꺼진 채 이유」).
const HIDDEN_REASONS = new Set(['korean', 'unsupported_language', 'not_owner', 'class_copy', 'passage', 'class_mode']);
export const boundaryReasonHidden = reason => HIDDEN_REASONS.has(reason);

/**
 * 이유 코드 → 화면 문구(한국어 원문 키 — 호출 쪽이 vt()로 3개 언어를 붙인다). viewerMessages.js에 세 벌이 있다.
 * 알 수 없는 코드는 일반 문구.
 */
export function boundaryReasonMessage(reason) {
  switch (reason) {
    case 'cross_line': return ['줄을 넘어서는 묶을 수 없어요'];
    case 'punctuation': return ['문장부호를 넘어서는 묶을 수 없어요'];
    case 'failed': return ['분석되지 않은 부분은 고칠 수 없어요'];
    case 'separable': return ['떨어진 동사(이합사) 조각은 묶거나 나눌 수 없어요'];
    case 'too_few': return ['두 단어 이상 골라 주세요'];
    case 'too_many': return ['한 번에 {count}개까지 묶을 수 있어요', { count: BOUNDARY_LIMITS.maxTokens }];
    case 'too_long': return ['너무 길어서 한 단어로 묶을 수 없어요'];
    case 'edit_limit': return ['이 자료에서는 더 고칠 수 없어요. 다시 분석한 뒤 고쳐 주세요'];
    case 'single_word': return ['한 단어라 나눌 수 없어요'];
    case 'too_short': return ['한 글자라 나눌 수 없어요'];
    case 'no_neighbor': return ['옆에 묶을 단어가 없어요'];
    case 'pending_edit': return ['적용하지 못한 단어 경계와 겹쳐서 고칠 수 없어요'];
    case 'stale_edits': return ['단어 경계 기록이 지금 분석과 달라요. 다시 분석한 뒤 고쳐 주세요'];
    case 'no_literal_cut': return ['이 단어는 나눌 자리가 없어요.'];
    default: return ['이 범위는 고칠 수 없어요'];
  }
}

/** 한국어 나누기 진입점(⋯ 「나누기」 · 조각 카드 줄)을 보일 수 있나 — 중·일·영과 같은 조건(소유자 · 사본/구간/수업 모드 제외), 언어만 한국어. */
export function koreanSplitEntryAllowed(ctx) {
  return !!ctx && ctx.owner === true && ctx.language === 'Korean' && !ctx.classCopy && !ctx.passage && !ctx.classMode;
}

/** 나눈 조각이면 {record, eojeol(원래 어절 토큰), baseId}, 아니면 null(카드 「나눈 조각 · [원래대로]」 · 저장 제외 판정). */
export const koreanBoundaryPiece = (json, tokenId) => koreanSplitRecordOf(json, tokenId);

export class BoundaryEditError extends Error {
  constructor(reason, message = reason) {
    super(message);
    this.name = 'BoundaryEditError';
    this.reason = reason;
  }
}

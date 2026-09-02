import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { isGradedReviewEvent } from '../weeklyReport';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const page = read('src/views/VocabPage.jsx');
const review = read('src/views/VocabReview.jsx');
const store = read('src/lib/learn/progressStore.js');
const outbox = read('src/lib/reviewOutbox.js');
const css = read('src/index.css');

/**
 * 계약: W 복습 화면 R2 (오너 지시 2026-09-02, #1077 5504350927).
 * 키 1~4는 「화면에 있는 4버튼 줄」에 작용(채점/보기 선택/오답 2버튼) · Ctrl/⌘+Z undo.
 * review_events는 RLS SELECT·INSERT뿐이라 못 지운다 → SRS 5필드 복원 + 세션 되감기 +
 * source:'ui' 보상 이벤트(isGradedReviewEvent 제외 재사용). 오프라인은 outbox 항목 제거.
 */
describe('복습 undo — SRS 복원 + 보상 이벤트 (VocabPage)', () => {
  const undo = sliceBetween(page, 'const undoLastGrade = async () => {', '\n  };');
  const score = sliceBetween(page, 'const handleScore = async (rating) => {', '\n  };');

  it('스냅샷은 채점 직전 SRS 5필드(행 값 그대로) + 세션 상태, 유효화는 저장 .then 이후', () => {
    expect(page).toContain("const SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];");
    expect(score).toContain('prev: Object.fromEntries(SRS_FIELDS.filter((k) => currentWord[k] !== undefined).map((k) => [k, currentWord[k]]))');
    expect(score).toContain('wasNew, reviewIdx, requeued: rating === 1,');
    expect(score).toContain('lastGradeRef.current = { ...snapshot, reviewedAt: r?.reviewedAt || null, queued: !!r?.queued };');
    // 채점 진행 중(scoringRef) undo 차단
    expect(undo).toContain('if (!last || scoringRef.current) return;');
  });

  it('undo 뒤 user_vocabulary 5필드가 스냅샷과 동일 — last_reviewed_at이 null이었으면 null(persistVocabGrade 4번째 인자)', () => {
    expect(undo).toContain("const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev;");
    expect(undo).toContain('await persistVocabGrade(supabase, last.wordId, prevStats, prevReviewedAt);');
  });

  it('세션 되감기 — reviewIdx·큐(재노출 제거)·introIds(신규 한도)·종료 화면이 채점 전으로', () => {
    expect(undo).toContain("if (last.requeued) setReviewQueue((q) => (q[q.length - 1] === last.wordId ? q.slice(0, -1) : q));");
    expect(undo).toContain('setIntroIds((prev) => { const next = prev.filter((id) => id !== last.wordId); saveIntroIds(next); return next; });');
    expect(undo).toContain('setReviewIdx(last.reviewIdx);');
    expect(undo).toContain('setShowAnswer(true);');
    expect(undo).toContain('setReviewFinished(false);');
    expect(undo).toContain('lastGradeRef.current = null;'); // redo 없음
  });

  it('보상 이벤트 정확히 1건 — source ui · detail.undo_of.reviewed_at = 원 채점 시각, 집계에서 제외된다', () => {
    expect(undo.match(/logReviewEvents\(/g)).toHaveLength(1);
    expect(undo).toContain("lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,");
    expect(undo).toContain("detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },");
    // 기존 계약 재사용 — ui는 채점 이벤트가 아니다(주간 리포트·약점 진단 무오염)
    expect(isGradedReviewEvent({ source: 'ui', correct: true })).toBe(false);
    expect(isGradedReviewEvent({ source: 'vocab', correct: true })).toBe(true);
    // 원 채점 시각은 progressStore가 결과에 동봉한다(가산 — 기존 ok/queued 유지)
    expect(store).toContain('return { ok: true, reviewedAt };');
    expect(store).toContain('if (queued) return { ok: true, queued: true, reviewedAt };');
    expect(store).toContain("return queued ? { ok: true, queued: true, reviewedAt } : { ok: false, error: new Error('offline-queue-unavailable') };");
  });

  it('오프라인 undo는 서버에 아무것도 쓰지 않고 outbox 항목을 제거한다(itemKey + reviewedAt 완전 일치)', () => {
    expect(undo).toContain('if (last.queued) {');
    const branch = sliceBetween(undo, 'if (last.queued) {', '} else {');
    expect(branch).toContain('await removeOutboxEntry({ userId: user.id, itemKey: last.itemKey, reviewedAt: last.reviewedAt });');
    expect(branch).not.toMatch(/persistVocabGrade|logReviewEvents|supabase/);
    expect(outbox).toContain('export async function removeOutboxEntry({ userId, itemKey, reviewedAt }) {');
    expect(outbox).toContain('rows.filter((e) => e.itemKey === itemKey && e.reviewedAt === reviewedAt).map((e) => e.seq)');
  });

  it('미루기(handleSkip)도 undo 대상 — 이벤트가 없으니 보상 이벤트도 없다', () => {
    const skip = sliceBetween(page, 'const handleSkip = () => {', '\n  };');
    expect(skip).toContain('rating: null, skip: true,');
    expect(undo).toContain('if (!last.skip && last.reviewedAt) {');
  });
});

describe('복습 키 1~4·⌘Z — 화면의 4버튼 줄에 작용 (VocabPage·VocabReview)', () => {
  const keys = sliceBetween(page, 'const reviewKeysRef = useRef({});', '}, [tab, reviewFinished, manualAddOpen]);');
  const row = sliceBetween(page, "const quizMode = effectiveMode === 'context' || effectiveMode === 'listening';", 'reviewKeysRef.current = {');

  it('줄 판정은 상태로(DOM 질의 금지): 채점 / 보기 선택 / 오답 2버튼 / 없음', () => {
    expect(row).toContain("showAnswer ? 'score'");
    expect(row).toContain("contextSelected === null && contextOptions.length > 0 && (effectiveMode !== 'listening' || ttsSupported) ? 'options'");
    expect(row).toContain("contextOptions[contextSelected]?.id !== currentWord.id ? 'wrong'");
    expect(row).not.toMatch(/querySelector|getElementsBy/);
    expect(keys).not.toMatch(/querySelector|getElementsBy/);
  });

  it('4버튼 줄이 없으면 무동작 · 입력 요소 포커스·조합키·채점 진행 중 무시', () => {
    expect(keys).toContain('if (!h.row) return;');
    expect(keys).toContain("t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable");
    expect(keys).toContain('if (inField || e.metaKey || e.ctrlKey || e.altKey) return;');
    expect(keys).toContain('if (!/^[1-4]$/.test(e.key)) return;');
    expect(page).toContain('canUndo: !!lastGradeRef.current && !scoringRef.current,');
  });

  it('객관식·듣기의 1~4는 클릭과 같은 함수(pickContextOption) — 정답 자동 3점·오답 2버튼 포함', () => {
    expect(keys).toContain("else if (h.row === 'options') h.pick?.(n - 1);");
    expect(keys).toContain("else if (h.row === 'wrong') { if (n === 1) h.score?.(1); else if (n === 2) h.reveal?.(); }");
    const pick = sliceBetween(page, 'const pickContextOption = (i) => {', '\n  };');
    expect(pick).toContain('if (opt.id === currentWord.id) setTimeout(() => handleScore(3), 700);');
    expect(review.match(/onClick=\{\(\) => pickContextOption\(i\)\}/g)).toHaveLength(2);
    expect(review).not.toMatch(/setContextSelected\(i\);\s*const isCorrect/);
  });

  it('⌘Z는 lastGradeRef가 없으면 무동작이고 입력 요소 안에서 기본 동작을 가로채지 않는다', () => {
    expect(keys).toContain("if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.altKey) {");
    expect(keys).toContain('if (inField || !h.canUndo) return;');
  });

  it('기존 Escape/Tab(수동 추가 다이얼로그) 리스너와 경쟁하지 않는다 — 다이얼로그가 열리면 복습 리스너가 빠진다', () => {
    expect(keys).toContain("if (tab !== 'review' || reviewFinished || manualAddOpen) return undefined;");
    expect(page).toContain("if (event.key === 'Escape' && !manualAddPendingRef.current) {");
  });

  it('힌트 — 숫자 배지(W R1 스타일 재사용)와 데스크톱 전용 안내 문구', () => {
    expect(review.match(/className="save-grade__key" aria-hidden="true"/g)).toHaveLength(4);
    expect(review).toContain('<span className="review-keys-hint"> · 키 1~4 · 되돌리기 Ctrl/⌘+Z</span>');
    expect(css).toContain('@media (pointer: fine) { .review-keys-hint { display: inline; } }');
    expect(css).toContain('.review-keys-hint { display: none; }');
  });
});

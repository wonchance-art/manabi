// REVIEW-SHELF-CLS-001 (2026-10-18 KST, 목업 A안 scratchpad/mockups/cls-vocab-materials.md) — 복습실 첫 그림은 「오늘」 카드 · 문법 칸이
// 정해진 뒤 한 번에. 「복습 준비 중…」(25px)이 「오늘 2개」(628px)로 자라며 아래 칸을 밀던 것(390 합성 계정 CLS 0.13–0.16 → 0).
// 실제 흔들림 · 실패 경로는 e2e learning-flow-clarity가 본다. 여기서는 영원히 골격에 갇히지 않는 판정(받는 중만 · 한 번 드러나면 끝 · 상한)을 지킨다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = fs.readFileSync(path.join(process.cwd(), 'src/views/VocabPage.jsx'), 'utf8');

describe('복습실 첫 그림(REVIEW-SHELF-CLS-001)', () => {
  it('받는 중(입장 한도 · FSRS 목록 · 문법 일정)만 기다린다 — 실패(error)는 정해진 것', () => {
    expect(src).toContain("const roomLoading = admission.status === 'loading' || fsrsReview.status === 'loading' || (!isBookScope && grammarLoading);");
    expect(src).not.toMatch(/const roomLoading = [^\n]*(heroPending|status !== 'ready')/);
  });
  it('한 번 드러나면 다시 골격으로 돌아가지 않고, FSRS 상한(20초)이 지나면 기다리지 않는다', () => {
    expect(src).toContain('useEffect(() => { if (!roomLoading) setRoomRevealed(true); }, [roomLoading]);');
    expect(src).toContain('setTimeout(() => setRoomRevealed(true), FSRS_LOADING_CAP_MS)');
    expect(src).toContain('const roomWaiting = !roomRevealed && roomLoading;');
  });
  it('기존 목록 골격(CardGridSkeleton)을 그대로 쓰고, 그 위 범위 막대도 같이 기다린다(골격을 밀지 않게)', () => {
    // 서버가 센 첫 화면 숫자가 있으면(VOCAB-FIRST-NUMBERS-001) 골격 대신 그 숫자로 「오늘」 카드와 범위 막대를 함께 그린다 — 막대와 카드가
    // 같은 판정(firstView)이라 막대가 나중에 끼어들어 카드를 밀지 않는다. 숫자가 없으면 지금처럼 둘 다 기다린다.
    expect(src).toContain("|| (tab === 'list' && roomWaiting)) ? (\n        <CardGridSkeleton height={120} />");
    expect(src).toContain("{!firstView && (isLoading || ");
    expect(src).toContain("{!inSession && tab === 'list' && user && (firstView || learningAvailable && !roomWaiting) && <ReviewScopeBar pending={!!firstView}");
  });
});

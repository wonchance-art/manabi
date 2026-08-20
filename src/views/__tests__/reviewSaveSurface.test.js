import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 복습 채점 저장의 무증상 실패 방지(전수 조사 발견 — 과거 '조용한 실패' 사고의
// 두 번째 겹). 낙관 전진(카드는 즉시 넘어감)은 유지하되, 실패는 토스트로 표면화하고
// 세션 종료 시 서버 정본과 재동기한다.

const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/VocabPage.jsx'), 'utf8');
const store = fs.readFileSync(path.join(process.cwd(), 'src/lib/learn/progressStore.js'), 'utf8');

describe('복습 저장 표면화 계약', () => {
  it('progressStore가 성공/실패를 반환값으로 노출한다(콘솔만 남기는 삼킴 금지)', () => {
    expect(store).toContain('return { ok: true };');
    expect(store).toContain('return { ok: false, error: err };');
  });

  it('채점 호출부가 실패를 토스트로 표면화한다 — 낙관 전진은 유지(await 블로킹 없음)', () => {
    expect(viewer).toMatch(/\}\)\.then\(\(r\) => \{\s*if \(r\?\.ok === false\) toast\('복습 저장 실패/);
    // 채점 흐름을 막는 await 부활 금지 — UX 계약(카드는 즉시 전진)
    expect(viewer).not.toMatch(/await recordReviewCompleted/);
  });

  it('세션 완료 시 vocab 캐시를 무효화한다 — 낙관 전진과 서버 정본의 재동기 지점', () => {
    const done = viewer.match(/setReviewFinished\(true\);[\s\S]{0,400}/)?.[0] || '';
    expect(done).toContain("queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] })");
  });

  it('FSRS 페이로드 계약 유지 — snake_case 3필드 + next_review_at(첫 번째 겹)', () => {
    expect(viewer).toContain('interval: nextStats.interval ?? 0');
    expect(viewer).toContain('ease_factor: nextStats.ease_factor ?? 0');
    expect(viewer).toContain('repetitions: nextStats.repetitions ?? 0');
    expect(viewer).not.toContain('easeFactor: nextStats');
  });
});

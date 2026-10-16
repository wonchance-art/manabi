import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase.js', () => ({ supabase: {} }));
const { createGrammarRetry, GRAMMAR_RETRY_LIMIT } = await import('../grammarSrs.js');

// 계약: /study 문법 재스케줄 보류함 — 저장 실패(오프라인 등)를 버리지 않고 남겼다가 같은 정본 함수로 다시 보낸다.
// review_events는 오프라인 큐로 올라가는데 grammar_review 일정만 조용히 사라지던 틈(StudySessionPage가 결과를 버림).

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const row = (slug, extra = {}) => ({ user_id: 'u1', lang: 'Japanese', slug, interval: 1, ...extra });

describe('createGrammarRetry', () => {
  it('실패 → 보류 → online 재시도 성공 → 보류 비움', async () => {
    let online = false;
    const grade = vi.fn(async (r, rating) => (online ? { ...r, rating } : null));
    const box = createGrammarRetry({ grade });
    expect(await box.submit(row('n5-wa'), 3)).toBeNull();
    expect(box.size()).toBe(1);
    online = true;
    await box.retry();
    expect(box.size()).toBe(0);
    expect(grade).toHaveBeenCalledTimes(2);
    expect(grade.mock.calls[1]).toEqual([row('n5-wa'), 3]); // 같은 행 · 같은 채점으로 다시
  });

  it('성공하면 보류하지 않는다', async () => {
    const box = createGrammarRetry({ grade: async (r) => r });
    expect(await box.submit(row('n5-wa'), 4)).toBe(true);
    expect(box.size()).toBe(0);
  });

  it('같은 챕터가 다시 들어오면 마지막 채점만 남는다', async () => {
    const grade = vi.fn(async () => null);
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa', { interval: 1 }), 2);
    await box.submit(row('n5-wa', { interval: 1 }), 4);
    await box.submit(row('n5-ga'), 1);
    expect(box.size()).toBe(2);
    grade.mockClear();
    await box.retry();
    expect(grade.mock.calls.map(([r, rating]) => [r.slug, rating]).sort()).toEqual([['n5-ga', 1], ['n5-wa', 4]]);
  });

  it(`재시도는 ${GRAMMAR_RETRY_LIMIT}번까지 — 넘으면 버리고 알린다`, async () => {
    const grade = vi.fn(async () => null);
    const onGiveUp = vi.fn();
    const box = createGrammarRetry({ grade, onGiveUp });
    await box.submit(row('n5-wa'), 3);
    for (let i = 0; i < GRAMMAR_RETRY_LIMIT + 2; i++) await box.retry();
    expect(grade).toHaveBeenCalledTimes(1 + GRAMMAR_RETRY_LIMIT);
    expect(box.size()).toBe(0);
    expect(onGiveUp).toHaveBeenCalledOnce();
  });

  it('던지는 저장도 실패로 보류하고, 겹친 재시도는 한 번만 보낸다', async () => {
    let calls = 0;
    const grade = vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('offline'); await new Promise((r) => setTimeout(r, 5)); return {}; });
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 3);
    expect(box.size()).toBe(1);
    const a = box.retry(), b = box.retry();
    expect(b).toBe(a);
    await a;
    expect(grade).toHaveBeenCalledTimes(2);
    expect(box.size()).toBe(0);
  });

  it('accept로 다른 계정의 보류분은 보내지 않는다', async () => {
    const grade = vi.fn(async () => null);
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 3);
    grade.mockClear();
    await box.retry((r) => r.user_id === 'u2');
    expect(grade).not.toHaveBeenCalled();
    expect(box.size()).toBe(1);
  });

  it('재시도 도중 같은 챕터 새 채점이 들어오면 새 채점이 남는다', async () => {
    let release;
    const grade = vi.fn()
      .mockResolvedValueOnce(null) // 첫 제출 실패
      .mockImplementationOnce(() => new Promise((r) => { release = r; })) // 재시도 진행 중
      .mockResolvedValueOnce(null); // 새 채점도 실패
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 2);
    const retrying = box.retry();
    await box.submit(row('n5-wa'), 4);
    release({});
    await retrying;
    expect(box.size()).toBe(1); // 옛 재시도 성공이 새 채점을 지우지 않는다
  });
});

describe('세션 화면 배선', () => {
  const page = read('src/views/StudySessionPage.jsx');

  it('챕터 마지막 문항은 보류함으로 보낸다(결과를 버리지 않는다)', () => {
    // user_id는 세션 계정(recorder — 로그아웃 · 계정 바뀜이면 기록 자체를 멈춘다, studySessionScreen 계약).
    expect(page).toContain('pendingGrammarRef.current.submit({ ...agg.srs, user_id: recorder }, ratingFromScore(agg.right, agg.total));');
    expect(page).not.toMatch(/^\s*gradeGrammarReview\(/m);
    expect(page).toContain('createGrammarRetry({ grade: gradeGrammarReview })');
  });

  it('online · pagehide · 세션 종료(fireEffects)에서 다시 보낸다', () => {
    expect(page).toContain("window.addEventListener('online', retryPendingGrammar);");
    expect(page).toContain("window.removeEventListener('online', retryPendingGrammar);");
    expect(page).toMatch(/function onPageHide\(\) \{\s*batcherRef\.current\?\.flush\(\);\s*retryPendingGrammar\(\);/);
    const fire = page.match(/function fireEffects\(\) \{[\s\S]*?\n {2}\}/)?.[0];
    expect(fire).toContain('retryPendingGrammar();');
  });
});

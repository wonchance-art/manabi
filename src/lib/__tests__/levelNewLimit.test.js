// LEVEL-NEW-LIMIT-001 — 한 번도 공부하지 않은 카드(담기만 한 단어 포함)는 서버가 첫 문제 때 하루 새 단어 몫을 쓴다(Anki 규칙). 몫을 다 쓰면
// 컨트롤러가 출제하지 않는데, 단어 페이지는 그 카드를 「오늘 복습」으로 보여 채점하게 했고 결과를 저장 실패(「채점을 저장하지 못했어요」 ·
// 카드 튕김)로 알렸다(운영 2026-10-30 12:21 KST — 새 단어 15/15 뒤 상태 읽기만 6번, 채점 요청 0). 이제는 'new-limit'으로 돌려 안내한다.
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// 한 번 채점(GRADE-ONE-REQUEST-001) 뒤로는 「몫이 남았나 · 이미 시작한 카드인가」를 서버가 판정한다(fsrsAnswer.test.js가 그 조건을 지킨다).
// 여기서는 단어 페이지가 서버의 거절(fsrs_new_budget_exhausted · 한도)을 'new-limit'으로, 그 밖의 거절은 실패로 옮기는지만 본다.
let refusal = null;
vi.mock('../fsrsLearningClient', () => ({ createFsrsLearningClient: () => ({
  start() {}, dispose() {},
  async answer(payload) { if (refusal) throw refusal; return { ok: true, grade: { operationId: `${payload.operationId}:grade`, revision: 1 } }; },
}) }));
const refused = (code, extra = {}) => Object.assign(new Error(code), { code, status: 409, ...extra });

const { gradeLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const owner = '10000000-0000-4000-8000-000000000001';
afterEach(() => { disposeLevelFsrs(); refusal = null; });

describe('LEVEL-NEW-LIMIT-001 — 오늘 새 단어 몫을 다 쓴 새 카드는 저장 실패가 아니다', () => {
  it('새 카드 · 몫 0이면 new-limit(한도 함께)', async () => {
    refusal = refused('fsrs_new_budget_exhausted', { limit: 15 });
    expect(await gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 })).toEqual({ ok: false, reason: 'new-limit', limit: 15 });
    refusal = refused('fsrs_new_budget_exhausted'); // 한도를 싣지 않은 거절(옛 서버) — 한도 없이 안내
    expect(await gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 })).toEqual({ ok: false, reason: 'new-limit', limit: null });
  });
  it('몫이 남았거나 · 이미 시작한 카드 · 복습 카드는 지금처럼 실패(다른 이유)', async () => {
    for (const code of ['fsrs_card_not_due', 'fsrs_attempt_conflict', 'fsrs_admission_pending', 'fsrs_storage_unavailable']) {
      refusal = refused(code);
      const result = await gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.error.code).toBe(code);
    }
  });
  it('단어 페이지는 new-limit을 오류 알림이 아닌 안내로 — 그 학습일 동안 새 카드는 넘기지 않고 안내(세 번째마다 서버에 다시 묻는다)', () => {
    const hook = fs.readFileSync('src/lib/useLevelWordGrade.js', 'utf8');
    expect(hook).toContain("if (!result.ok && result.reason === 'new-limit') return { ok: false, reason: 'new-limit', limit: result.limit };");
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain("if (res.reason === 'new-limit') { newLimitHit.current = { day: learningDay(schedulerTime(Date.now())), limit: res.limit, tries: 0 }; newLimitNotice(res.limit, entry); }");
    expect(screen).toContain('`오늘 새 단어 ${limit}개를 다 했어요 — 내일 이어서 나와요`');
    expect(screen).toContain("&& info.projection?.source === 'fsrs-v1' && info.projection.memory?.state === 'New') {");
  });
});

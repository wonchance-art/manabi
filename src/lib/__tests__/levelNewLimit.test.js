// LEVEL-NEW-LIMIT-001 — 한 번도 공부하지 않은 카드(담기만 한 단어 포함)는 서버가 첫 문제 때 하루 새 단어 몫을 쓴다(Anki 규칙). 몫을 다 쓰면
// 컨트롤러가 출제하지 않는데, 단어 페이지는 그 카드를 「오늘 복습」으로 보여 채점하게 했고 결과를 저장 실패(「채점을 저장하지 못했어요」 ·
// 카드 튕김)로 알렸다(운영 2026-10-30 12:21 KST — 새 단어 15/15 뒤 상태 읽기만 6번, 채점 요청 0). 이제는 'new-limit'으로 돌려 안내한다.
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

let snapshot = {};
vi.mock('../useFsrsReview', () => ({ createFsrsReviewController: () => ({
  start() {}, dispose() {}, setWords() {},
  getSnapshot: () => snapshot,
  async question() { return false; }, async reveal() { return true; }, async grade() { return true; },
}) }));
vi.mock('../fsrsLearningClient', () => ({ createFsrsLearningClient: () => ({}) }));

const { gradeLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const owner = '10000000-0000-4000-8000-000000000001';
afterEach(() => disposeLevelFsrs());
const card = (state, firstQuestionAt = null) => ({ cardId: 'A', card: { state }, firstQuestionAt });

describe('LEVEL-NEW-LIMIT-001 — 오늘 새 단어 몫을 다 쓴 새 카드는 저장 실패가 아니다', () => {
  it('새 카드 · 몫 0이면 new-limit(한도 함께)', async () => {
    snapshot = { cards: [card('New')], admission: { active: true, remaining: 0, limit: 15 }, error: null };
    expect(await gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 })).toEqual({ ok: false, reason: 'new-limit', limit: 15 });
  });
  it('몫이 남았거나 · 이미 시작한 카드 · 복습 카드는 지금처럼 실패(다른 이유)', async () => {
    for (const [cards, admission] of [[[card('New')], { active: true, remaining: 3, limit: 15 }],
      [[card('New', '2026-10-30T03:00:00Z')], { active: true, remaining: 0, limit: 15 }],
      [[card('Review')], { active: true, remaining: 0, limit: 15 }]]) {
      snapshot = { cards, admission, error: null };
      const result = await gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBeUndefined();
    }
  });
  it('단어 페이지는 new-limit을 오류 알림이 아닌 안내로 — 그 학습일 동안 새 카드는 넘기지 않고 안내(세 번째마다 서버에 다시 묻는다)', () => {
    const hook = fs.readFileSync('src/lib/useLevelWordGrade.js', 'utf8');
    expect(hook).toContain("if (!result.ok && result.reason === 'new-limit') return { ok: false, reason: 'new-limit', limit: result.limit };");
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain("if (res.reason === 'new-limit') { newLimitHit.current = { day: learningDay(schedulerTime(Date.now())), limit: res.limit, tries: 0 }; newLimitNotice(res.limit); }");
    expect(screen).toContain('`오늘 새 단어 ${limit}개를 다 했어요 — 내일 이어서 나와요`');
    expect(screen).toContain("&& info.projection?.source === 'fsrs-v1' && info.projection.memory?.state === 'New') {");
  });
});

// LEVEL-FSRS-SERIAL-001 — 단어 페이지의 FSRS 채점은 한 줄로. 앞 카드의 묻기 · 보이기 · 채점이 끝나기 전에 다음 카드를 채점해도
// 둘 다 저장된다(전에는 다음 채점의 setWords가 앞 카드를 지우고, 다음 채점은 컨트롤러 잠금으로 실패 — 둘 다 「채점을 저장하지 못했어요」).
import { afterEach, describe, expect, it, vi } from 'vitest';

const log = [];
let release = () => {};
// 실제 컨트롤러(useFsrsReview)의 두 성질만 흉내 낸다: run 중이면 잠금(false) · 요청 뒤 그 카드가 목록에 없으면 실패(false).
function fakeController() {
  let words = [], locked = false, current = null;
  const visible = id => words.some(w => w.id === id);
  const run = async (step, id) => {
    if (locked) { log.push(`${step}:${id}:locked`); return false; }
    locked = true;
    try {
      await new Promise(resolve => { release = resolve; setTimeout(resolve, 5); });
      if (!visible(id)) { log.push(`${step}:${id}:evicted`); return false; }
      log.push(`${step}:${id}`);
      return true;
    } finally { locked = false; }
  };
  return {
    start() {}, dispose() {},
    setWords(next) { words = next; },
    getSnapshot: () => ({ current, error: null }),
    async question(id) { const ok = await run('question', id); current = ok ? { cardId: id, phase: 'question' } : null; return ok; },
    async reveal() { const id = current?.cardId; const ok = await run('reveal', id); if (ok) current = { cardId: id, phase: 'revealed' }; return ok; },
    async grade() { const id = current?.cardId; const ok = await run('grade', id); if (ok) current = null; return ok; },
    async undo() { log.push('undo'); return true; },
  };
}
vi.mock('../useFsrsReview', () => ({ createFsrsReviewController: () => fakeController() }));
vi.mock('../fsrsLearningClient', () => ({ createFsrsLearningClient: () => ({}) }));

const { gradeLevelFsrs, undoLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const owner = '10000000-0000-4000-8000-000000000001';
afterEach(() => { disposeLevelFsrs(); log.length = 0; });

describe('LEVEL-FSRS-SERIAL-001', () => {
  it('앞 채점이 끝나기 전의 다음 채점도 둘 다 저장되고, 순서대로 한다', async () => {
    const a = gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 });
    const b = gradeLevelFsrs({ accountId: owner, row: { id: 'B' }, rating: 4 });
    expect(await a).toEqual({ ok: true });
    expect(await b).toEqual({ ok: true });
    expect(log).toEqual(['question:A', 'reveal:A', 'grade:A', 'question:B', 'reveal:B', 'grade:B']);
  });
  it('앞 일이 실패해도 다음 일은 한다 · 되돌리기는 진행 중인 채점 뒤에', async () => {
    const a = gradeLevelFsrs({ accountId: owner, row: null, rating: 3 }); // 행 없음 — 앞 일 실패
    const b = gradeLevelFsrs({ accountId: owner, row: { id: 'B' }, rating: 2 });
    const u = undoLevelFsrs({ accountId: owner });
    await expect(a).rejects.toBeTruthy();
    expect(await b).toEqual({ ok: true });
    await u;
    expect(log).toEqual(['question:B', 'reveal:B', 'grade:B', 'undo']);
  });
});

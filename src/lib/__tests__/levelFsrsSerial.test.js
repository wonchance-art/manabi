// LEVEL-FSRS-SERIAL-001 — 단어 페이지의 FSRS 채점은 한 줄로. 앞 카드의 채점이 끝나기 전에 다음 카드를 채점해도
// 둘 다 저장된다(전에는 다음 채점의 setWords가 앞 카드를 지우고, 다음 채점은 컨트롤러 잠금으로 실패 — 둘 다 「채점을 저장하지 못했어요」).
import { afterEach, describe, expect, it, vi } from 'vitest';

const log = [];
// 한 번 채점(GRADE-ONE-REQUEST-001) 뒤로 탭 하나 = answer 요청 하나. 요청이 걸리는 동안(운영 수백 ms~수 s) 다음 탭이 오면 앞 요청이
// 끝난 뒤에 보낸다 — 겹쳐 보내지 않는다(되돌리기가 어느 채점을 겨누는지 흐려지지 않게). 겹치면 'overlap'을 남긴다.
let inFlight = 0;
const answerRequest = async ({ cardId }) => {
  if (inFlight++) log.push(`overlap:${cardId}`);
  log.push(`send:${cardId}`);
  try { await new Promise(resolve => setTimeout(resolve, 5)); log.push(`done:${cardId}`); }
  finally { inFlight--; }
};
vi.mock('../fsrsLearningClient', () => ({ createFsrsLearningClient: () => ({
  start() {}, dispose() {},
  async answer(payload) { await answerRequest(payload); return { ok: true, grade: { operationId: `${payload.operationId}:grade`, revision: 1 } }; },
  async submit() { log.push('undo'); return { queued: true, status: 'pending' }; },
}) }));

const { gradeLevelFsrs, undoLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const owner = '10000000-0000-4000-8000-000000000001';
afterEach(() => { disposeLevelFsrs(); log.length = 0; });

describe('LEVEL-FSRS-SERIAL-001', () => {
  it('앞 채점이 끝나기 전의 다음 채점도 둘 다 저장되고, 순서대로 한다', async () => {
    const a = gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3 });
    const b = gradeLevelFsrs({ accountId: owner, row: { id: 'B' }, rating: 4 });
    expect(await a).toEqual({ ok: true });
    expect(await b).toEqual({ ok: true });
    expect(log).toEqual(['send:A', 'done:A', 'send:B', 'done:B']);
  });
  it('앞 일이 실패해도 다음 일은 한다 · 되돌리기는 진행 중인 채점 뒤에', async () => {
    const a = gradeLevelFsrs({ accountId: owner, row: null, rating: 3 }); // 행 없음 — 앞 일 실패
    const b = gradeLevelFsrs({ accountId: owner, row: { id: 'B' }, rating: 2 });
    const u = undoLevelFsrs({ accountId: owner });
    await expect(a).rejects.toBeTruthy();
    expect(await b).toEqual({ ok: true });
    await u;
    expect(log).toEqual(['send:B', 'done:B', 'undo']);
  });
});

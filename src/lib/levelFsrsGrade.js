// HSK 단어 페이지 — 엄격 FSRS 카드(서버 등록 카드)의 채점. 탭 하나 = 요청 하나(GRADE-ONE-REQUEST-001, 오너 승인 「한 장 = 요청 한 번」).
// 서버가 묻기(question) · 보이기(reveal) · 채점(grade)을 차례로 한다 — 단건 연산과 같은 검증 · 전이 · 반영, 시각 · 판본 · 입장 한도는 서버 것.
// 전에는 복습실 컨트롤러로 묻기 · 보이기 · 채점을 따로 보내고 단계마다 카드 목록 전체(fsrs_list_states)를 다시 읽었다(한 장에 요청 6 · DB 약 18).
// 단어 페이지는 답을 보여 주는 화면이라 묻기 · 보이기를 채점 순간에 잇는다(답을 본 채 묻지 않는 출제 규칙은 서버가 지킨다).
// 되돌리기는 지금처럼 보낼함의 undo 연산 하나(복습실과 같은 길) — 마지막 채점의 연산 ID · 채점 뒤 판본을 여기 둔다.
let holder = null; // { accountId, ready: Promise<client>, dispose }
let lastGrade = null; // { accountId, cardId, operationId, revision, undoPayload }
const makeId = () => globalThis.crypto.randomUUID();

async function clientFor(accountId) {
  if (holder?.accountId === accountId) return holder.ready;
  holder?.dispose?.();
  const ready = import('./fsrsLearningClient').then((learning) => {
    const client = learning.createFsrsLearningClient({ accountId, getAccountId: () => holder?.accountId ?? null });
    client.start?.(); // 보낼함(되돌리기 · 다른 화면의 채점)을 연결 · 포커스 때 보낸다 — 컨트롤러가 하던 것
    return client;
  });
  holder = { accountId, ready, dispose: () => ready.then((c) => c.dispose?.()).catch(() => {}) };
  try { return await ready; } catch (error) { if (holder?.ready === ready) holder = null; throw error; } // 그사이 다른 계정으로 바뀌었으면 그쪽은 둔다
}

// 채점 · 되돌리기는 한 줄로 세운다(LEVEL-FSRS-SERIAL-001). 단어 페이지는 채점하자마자 다음 카드로 넘어가므로(낙관), 앞 카드의
// 요청이 끝나기 전에 다음 카드를 채점할 수 있다 — 되돌리기가 어느 채점을 되돌리는지 흐려지지 않게 차례대로 보낸다.
// 앞 일이 실패해도 다음 일은 그대로 한다.
let tail = Promise.resolve();
function serial(work) {
  const run = tail.then(work, work);
  tail = run.catch(() => {});
  return run;
}

/**
 * row = 단어장 행(id = 카드 id). 결과 { ok, error } · { ok:false, reason:'new-limit', limit }. waitMs = 차례가 올 때까지(되돌린 뒤
 * 30초 · 곧 오는 학습 단계 — fsrsGradeWait). 기다림은 줄 밖에서 한다 — 다른 카드의 채점을 붙잡지 않는다. 화면을 떠나도(같은 탭)
 * 기다린 뒤 보낸다(전송자는 다시 만든다). 탭 ID는 여기서 한 번 — 다시 보내도(연결 끊김 · 곧 차례) 같은 ID라 두 번 채점되지 않는다.
 */
export function gradeLevelFsrs({ waitMs = 0, ...args }) {
  const tap = { ...args, operationId: makeId() };
  if (!(waitMs > 0)) return serial(() => gradeOnce(tap));
  const run = new Promise((resolve) => setTimeout(resolve, waitMs + WAIT_SLACK_MS)).then(() => serial(() => gradeOnce(tap)));
  waiting.add(run);
  run.finally(() => waiting.delete(run)).catch(() => {});
  return run;
}
// 기다리는 채점 — 되돌리기는 이것들이 보내진 뒤에 한다(기다리는 동안 누른 「되돌리기」가 되돌릴 것이 없다고 실패하지 않게).
const waiting = new Set();
// 브라우저 시계와 서버 시계의 어긋남 · 응답 지연을 덮는 여유. 그래도 이르면 한 번 더 기다린다(gradeOnce).
const WAIT_SLACK_MS = 1500;

// 서버 기준으로 아직 몇 초 이른가(다음 질문 시각이 곧) — 그때만 한 번 더 기다린다.
function waitedEarly(error) {
  const next = Date.parse(error?.nextQuestionAt || '');
  return Number.isFinite(next) && next - Date.now() < WAIT_SLACK_MS * 4 && next - Date.now() > -WAIT_SLACK_MS * 4;
}

// 한 번도 공부하지 않은 카드(New)는 첫 문제 때 하루 새 단어 몫을 쓴다(Anki와 같은 서버 규칙). 몫이 다 찼으면 서버가 묻지 않고
// fsrs_new_budget_exhausted(한도 함께)로 돌려준다 — 저장 실패가 아니라 「오늘 새 단어 다 함」이다(LEVEL-NEW-LIMIT-001).
const newLimit = (error) => error?.code === 'fsrs_new_budget_exhausted'
  ? { ok: false, reason: 'new-limit', limit: Number.isInteger(error.limit) ? error.limit : null } : null;

async function gradeOnce({ accountId, row, rating, operationId }) {
  const payload = { action: 'answer', accountId, cardId: row.id, operationId, rating };
  const client = await clientFor(accountId);
  let response;
  try { response = await client.answer(payload); }
  catch (error) {
    if (newLimit(error)) return newLimit(error);
    if (!(error?.code === 'fsrs_card_not_due' && waitedEarly(error))) return { ok: false, error };
    await new Promise((resolve) => setTimeout(resolve, WAIT_SLACK_MS * 2));
    try { response = await client.answer(payload); }
    catch (again) { return newLimit(again) || { ok: false, error: again }; }
  }
  lastGrade = { accountId, cardId: row.id, operationId: response.grade.operationId, revision: response.grade.revision, undoPayload: null };
  return { ok: true };
}

/** 마지막 채점을 되돌린다 — 보낼함의 undo 연산(복습실 컨트롤러의 undo와 같은 꾸러미 · 같은 영속 수락). */
export async function undoLevelFsrs({ accountId }) {
  await Promise.allSettled([...waiting]);
  return serial(async () => {
    const client = await clientFor(accountId);
    const last = lastGrade;
    if (!last || last.accountId !== accountId) throw new Error('되돌릴 수 있는 채점이 없어요.');
    // 같은 되돌리기를 다시 누르면 같은 연산 ID(보낼함이 같은 원본으로 받는다).
    last.undoPayload ||= { action: 'undo', accountId, operationId: makeId(), cardId: last.cardId,
      expectedRevision: last.revision, targetOperationId: last.operationId };
    const result = await client.submit(last.undoPayload);
    if (result?.queued !== true) throw new Error('fsrs_undo_not_durably_accepted');
    if (!['pending', 'applied', 'replayed'].includes(result.status)) throw new Error('fsrs_sync_blocked');
    if (lastGrade === last) lastGrade = null;
  });
}

/** 계정이 바뀌거나 화면을 떠나면 버린다. */
export function disposeLevelFsrs() {
  holder?.dispose?.();
  holder = null;
  lastGrade = null;
  tail = Promise.resolve();
}

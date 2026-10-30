// HSK 단어 페이지 — 엄격 FSRS 카드(서버 등록 카드)의 채점. 복습실과 같은 컨트롤러(createFsrsReviewController)를 처음 필요할 때만 받는다.
// 서버 규칙 그대로: 복습 차례인 카드만 묻고(question) · 답을 보이고(reveal) · 채점(grade)한다. 되돌리기는 컨트롤러의 undo 한 길.
// 단어 페이지는 답을 보여 주는 화면이라 묻기 · 보이기를 채점 순간에 잇는다(답을 본 채 묻지 않는 출제 규칙은 서버가 지킨다).
let holder = null; // { accountId, controller, ready: Promise }

async function controllerFor(accountId) {
  if (holder?.accountId === accountId) return holder.ready;
  holder?.dispose?.();
  const ready = Promise.all([import('./useFsrsReview'), import('./fsrsLearningClient')]).then(([review, learning]) => {
    const controller = review.createFsrsReviewController({ accountId,
      client: learning.createFsrsLearningClient({ accountId, getAccountId: () => holder?.accountId ?? null }) });
    controller.start();
    return controller;
  });
  holder = { accountId, ready, dispose: () => ready.then((c) => c.dispose()).catch(() => {}) };
  try { return await ready; } catch (error) { if (holder?.ready === ready) holder = null; throw error; } // 그사이 다른 계정으로 바뀌었으면 그쪽은 둔다
}

// 채점 · 되돌리기는 한 줄로 세운다(LEVEL-FSRS-SERIAL-001). 단어 페이지는 채점하자마자 다음 카드로 넘어가므로(낙관), 앞 카드의
// 묻기 · 보이기 · 채점(운영 2~8 s)이 끝나기 전에 다음 카드를 채점할 수 있다. 그때 다음 채점의 setWords가 앞 카드를 목록에서 지워
// 앞 카드가 「보이지 않는 카드」로 실패하고, 다음 카드는 컨트롤러 잠금(run의 locked)으로 바로 실패했다 — 둘 다 「채점을 저장하지 못했어요」
// (운영 edge 로그 2026-10-27 KST: 묻기 · 보이기만 반영되고 채점이 빠진 묶음). 앞 일이 실패해도 다음 일은 그대로 한다.
let tail = Promise.resolve();
function serial(work) {
  const run = tail.then(work, work);
  tail = run.catch(() => {});
  return run;
}

/**
 * row = 단어장 행(id = 카드 id). 결과 { ok, error }. waitMs = 차례가 올 때까지(되돌린 뒤 30초 · 곧 오는 학습 단계 — fsrsGradeWait).
 * 기다림은 줄 밖에서 한다 — 다른 카드의 채점을 붙잡지 않는다. 화면을 떠나도(같은 탭) 기다린 뒤 보낸다(제어기는 다시 만든다).
 */
export function gradeLevelFsrs({ waitMs = 0, ...args }) {
  if (!(waitMs > 0)) return serial(() => gradeOnce(args));
  const run = new Promise((resolve) => setTimeout(resolve, waitMs + WAIT_SLACK_MS)).then(() => serial(() => gradeOnce(args)));
  waiting.add(run);
  run.finally(() => waiting.delete(run)).catch(() => {});
  return run;
}
// 기다리는 채점 — 되돌리기는 이것들이 보내진 뒤에 한다(기다리는 동안 누른 「되돌리기」가 되돌릴 것이 없다고 실패하지 않게).
const waiting = new Set();
// 브라우저 시계와 서버 시계의 어긋남 · 응답 지연을 덮는 여유. 그래도 이르면 한 번 더 기다린다(gradeOnce).
const WAIT_SLACK_MS = 1500;

// 서버 기준으로 아직 몇 초 이른가(다음 질문 시각이 곧) — 그때만 한 번 더 기다린다.
function waitedEarly(snap, cardId) {
  const entry = snap.cards?.find((c) => c.cardId === cardId), next = Date.parse(entry?.nextQuestionAt || '');
  return Number.isFinite(next) && next - Date.now() < WAIT_SLACK_MS * 4 && next - Date.now() > -WAIT_SLACK_MS * 4;
}

async function gradeOnce({ accountId, row, rating }) {
  const controller = await controllerFor(accountId);
  controller.setWords([row], [row.id]);
  let asked = await controller.question(row.id);
  if (!asked && waitedEarly(controller.getSnapshot(), row.id)) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_SLACK_MS * 2));
    asked = await controller.question(row.id);
  }
  if (!asked) {
    // 한 번도 공부하지 않은 카드(New)는 첫 문제 때 하루 새 단어 몫을 쓴다(Anki와 같은 서버 규칙). 몫이 다 찼으면 출제하지 않으므로
    // 저장 실패가 아니라 「오늘 새 단어 다 함」이다(LEVEL-NEW-LIMIT-001 — 담기만 한 단어가 「오늘 복습」으로 보여 튕기던 것).
    const snap = controller.getSnapshot(), entry = snap.cards?.find((c) => c.cardId === row.id), admission = snap.admission;
    if (entry?.card?.state === 'New' && !entry.firstQuestionAt && !(admission?.active && admission.remaining > 0)) {
      return { ok: false, reason: 'new-limit', limit: Number.isInteger(admission?.limit) ? admission.limit : null };
    }
    return { ok: false, error: snap.error || new Error('fsrs_card_not_due') };
  }
  if (controller.getSnapshot().current?.phase !== 'revealed' && !(await controller.reveal())) {
    return { ok: false, error: controller.getSnapshot().error || new Error('fsrs_reveal_failed') };
  }
  if (!(await controller.grade(rating))) return { ok: false, error: controller.getSnapshot().error || new Error('fsrs_grade_failed') };
  return { ok: true };
}

export async function undoLevelFsrs({ accountId }) {
  await Promise.allSettled([...waiting]);
  return serial(async () => {
    const controller = await controllerFor(accountId);
    if (!(await controller.undo())) throw controller.getSnapshot().error || new Error('되돌릴 수 있는 채점이 없어요.');
  });
}

/** 계정이 바뀌거나 화면을 떠나면 버린다. */
export function disposeLevelFsrs() {
  holder?.dispose?.();
  holder = null;
  tail = Promise.resolve();
}

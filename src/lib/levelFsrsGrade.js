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
  try { return await ready; } catch (error) { holder = null; throw error; }
}

/** row = 단어장 행(id = 카드 id). 결과 { ok, error }. */
export async function gradeLevelFsrs({ accountId, row, rating }) {
  const controller = await controllerFor(accountId);
  controller.setWords([row], [row.id]);
  if (!(await controller.question(row.id))) return { ok: false, error: controller.getSnapshot().error || new Error('fsrs_card_not_due') };
  if (controller.getSnapshot().current?.phase !== 'revealed' && !(await controller.reveal())) {
    return { ok: false, error: controller.getSnapshot().error || new Error('fsrs_reveal_failed') };
  }
  if (!(await controller.grade(rating))) return { ok: false, error: controller.getSnapshot().error || new Error('fsrs_grade_failed') };
  return { ok: true };
}

export async function undoLevelFsrs({ accountId }) {
  const controller = await controllerFor(accountId);
  if (!(await controller.undo())) throw controller.getSnapshot().error || new Error('되돌릴 수 있는 채점이 없어요.');
}

/** 계정이 바뀌거나 화면을 떠나면 버린다. */
export function disposeLevelFsrs() {
  holder?.dispose?.();
  holder = null;
}

// 계정 확인 전의 누름(VIEWER-MEMBER-SSR-001 ㉠ 「처음부터 자리 잡기」, 오너 2026-11-04 KST) — 뷰어가 계정 줄(서재에 담기 · 신고)을
// 첫 그림부터 그리면, 계정 · 담김 상태가 오기 전(약 1.3초)에도 누를 수 있다. 그 누름은 버리지 않고(아무 일 없음 · 오류 0) 기다렸다가
// 확인되면 한 번 한다. 순수 모듈 — 버튼(LibrarySaveButton · ReportMaterialButton)이 같은 판정을 쓴다.

/**
 * 기다리던 누름을 지금 어떻게 하나.
 * queued = 누를 때의 계정(서버가 읽은 계정) · null이면 기다리는 누름 없음. account = 지금 확인된 계정(없으면 아직 확인 전).
 * @returns {'none' | 'wait' | 'drop' | 'run'} drop = 다른 계정으로 확인됐다(남의 누름을 대신하지 않는다).
 */
export function queuedPressStep({ queued, account, ready = true, busy = false }) {
  if (!queued) return 'none';
  if (!account) return 'wait';
  if (queued !== account) return 'drop';
  return ready && !busy ? 'run' : 'wait';
}

/**
 * 서재 담기 버튼이 할 일. intent 'save' = 확인 전에 누른 「서재에 담기」 — 확인해 보니 이미 담겼으면 아무것도 하지 않는다
 * (누른 뜻과 반대로 빼지 않는다). 휴지통에 있으면 복원이 곧 담기다.
 * @returns {'save' | 'restore' | 'trash' | null}
 */
export function libraryToggleOp(row, intent = null) {
  if (!row) return null;
  if (row.saved) return intent === 'save' ? null : 'trash';
  return row.state === 'trashed' ? 'restore' : 'save';
}

// 단어 페이지(HSK · JLPT · 영어 · 프랑스어) 기기 설정 — 언어마다 따로(판의 prefsKey) localStorage에 둔다.
//
// 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 승인 2026-10-31 KST, 시안 4차 · 같은 날 단순화): 제목 ▾ 시트의 세 줄.
//   순서 = 오늘 줄에 새 단어를 어디에 세울지(혼합 = 복습 사이에 고르게 · 새 단어 먼저 · 복습 먼저). 거르지 않는다 — 늘 모두 선다.
//   분량 = 이번에 할 개수(10개 · 20개 · 전체). 남은 단어는 버리지 않고 끝 화면 「이어서 N개」로 잇는다.
//   세부 = 「2단 평가」(다시 · 알맞음 두 칸만 — 서버 채점 길은 그대로, 1 · 3은 원래 있는 등급).
// 기본값은 예전 동작 그대로다(혼합 · 전체 · 끔).
// 예전 「보기」 줄(성조 색 · 예문 후리가나 · 성 색 스위치와 「리스트 한 번에」)은 없앴다 — tone은 늘 켬, page는 늘 20(꺼 둔 사람도 기본으로 돌아온다).

// 보기 탭(네 영역 체크 — 오너 승인 2026-10-21 KST): [단어]가 기본이고 실제 복습 일정(네 칸)은 이 탭만 바꾼다.
// 문장 · 뜻 · 소리는 스스로 더 다지고 싶은 사람의 연습(두 칸 · 일정 없음), 전체는 훑어보기(채점 없음).
export const LEVEL_WORD_VIEWS = Object.freeze([
  { id: 'word', label: '단어' }, { id: 'sentence', label: '문장' }, { id: 'meaning', label: '뜻' }, { id: 'sound', label: '소리' }, { id: 'all', label: '전체' },
]);

export const LEVEL_STUDY_ORDERS = Object.freeze([
  Object.freeze({ id: 'mix', label: '혼합' }),
  Object.freeze({ id: 'new-first', label: '새 단어 먼저' }),
  Object.freeze({ id: 'review-first', label: '복습 먼저' }),
]);
export const LEVEL_STUDY_AMOUNTS = Object.freeze([
  Object.freeze({ id: 10, label: '10개' }),
  Object.freeze({ id: 20, label: '20개' }),
  // 「전체」는 기호 ∞로 짧게(오너 2026-10-31 KST) — 화면 읽기에는 「전체」로 읽힌다(aria).
  Object.freeze({ id: 'all', label: '∞', aria: '전체', sym: true }),
]);

// 한 단어 모드가 기본. 리스트는 아직 채점하지 않은 카드를 한 번에 page장(20)까지 펼친다 — 고르는 칸은 없앴다(고정).
export const LEVEL_WORD_PREFS = Object.freeze({ mode: 'one', view: 'word', tone: true, page: 20, order: 'mix', amount: 'all', two: false, v: 2 });

export function normalizeLevelWordPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  // v2 전에 저장된 「전체」는 그때의 기본값이라 새 기본(단어)으로 옮긴다 — 전체가 채점 없는 훑기로 바뀌었다.
  const view = p.v !== 2 && p.view === 'all' ? 'word' : p.view;
  return {
    mode: p.mode === 'list' ? 'list' : 'one',
    view: LEVEL_WORD_VIEWS.some((v) => v.id === view) ? view : 'word',
    tone: LEVEL_WORD_PREFS.tone, // 고정 — 저장값(false)은 읽지 않는다
    page: LEVEL_WORD_PREFS.page, // 고정 — 예전 10 · 50도 20으로
    order: LEVEL_STUDY_ORDERS.some((o) => o.id === p.order) ? p.order : LEVEL_WORD_PREFS.order,
    amount: LEVEL_STUDY_AMOUNTS.some((a) => a.id === p.amount) ? p.amount : LEVEL_WORD_PREFS.amount,
    two: p.two === true,
    v: 2,
  };
}

/** 세션 줄에 넘길 옵션 — 분량은 숫자(전체 = Infinity). */
export const levelStudyOptions = (prefs) => ({ order: prefs?.order || 'mix', amount: Number.isInteger(prefs?.amount) ? prefs.amount : Infinity });

/**
 * 진행 줄 칩 — 기본이 아닌 것만, 정한 차례(순서 · 분량 · 2단 평가)로 「 · 」로 잇는다. 모두 기본이면 null(칩 없음).
 * 예: { order: 'new-first', amount: 10, two: true } → 「새 단어 먼저 · 10개 · 2단 평가」.
 */
export function levelStudyChip(prefs) {
  const parts = [];
  if (prefs?.order && prefs.order !== 'mix') parts.push(LEVEL_STUDY_ORDERS.find((o) => o.id === prefs.order)?.label);
  if (prefs?.amount !== undefined && prefs.amount !== 'all') parts.push(LEVEL_STUDY_AMOUNTS.find((a) => a.id === prefs.amount)?.label);
  if (prefs?.two) parts.push('2단 평가');
  const shown = parts.filter(Boolean);
  return shown.length ? shown.join(' · ') : null;
}

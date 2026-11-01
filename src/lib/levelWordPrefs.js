// 단어 페이지(HSK · JLPT · 영어 · 프랑스어) 기기 설정 — 언어마다 따로(판의 prefsKey) localStorage에 둔다.
//
// 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 승인 2026-10-31 KST, 시안 4차 · 같은 날 단순화): 제목 ▾ 시트의 두 줄.
//   순서 = 오늘 줄에 새 단어를 어디에 세울지(혼합 = 복습 사이에 고르게 · 새 단어 먼저 · 복습 먼저). 거르지 않는다 — 늘 모두 선다.
//   칸 이름은 아래 표(LEVEL_STUDY_ORDERS) 한 곳 — 오너가 Anki 말(섞기 · 복습 전 · 복습 후 등)을 고르면 표의 label만 바꾼다(id는 옛 저장값 호환이라 그대로).
//   하루 = 하루 새 단어 수(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST — 「분량」 줄 자리). 기기 설정이 아니다: 단어장 복습 설정과 같은
//   정본(서버 입장 한도, 호환 모드면 vocab_new_per_day)이라 여기 prefs에 두지 않는다 — 고르기 칩만 이 모듈에 둔다.
// 「분량」(10개 · 20개 · 전체 · 「이어서 N개」)은 뺐다(같은 날 — Anki처럼 끝내려면 나가면 된다). 옛 저장값 amount는 읽지 않는다.
// 기본값은 예전 동작 그대로다(혼합). 「2단 평가」 · 정렬 · 임의 출제는 검토 뒤 뺐다(오너 2026-10-31 KST).
// 예전 「보기」 줄(성조 색 · 예문 후리가나 · 성 색 스위치와 「리스트 한 번에」)은 없앴다 — tone은 늘 켬, page는 늘 20(꺼 둔 사람도 기본으로 돌아온다).

import { NEW_PER_DAY_MAX, NEW_PER_DAY_UNLIMITED, isNewPerDayValue } from './vocabStudy.js';

// 보기 탭(단어 · 문장 · 뜻 · 소리 · 전체)은 없앴다(CARD-TYPES-001 A안 · 오너 2026-11-01 KST) — 카드 종류(단어 → 뜻 · 뜻 → 단어 · 듣기)가 연습 탭을
// 흡수했고, 「전체」(훑어보기)는 끝 화면 단추로 옮겼다(기기 설정이 아니다). 옛 저장값 view는 읽지 않는다.

export const LEVEL_STUDY_ORDERS = Object.freeze([
  Object.freeze({ id: 'mix', label: '혼합' }), // 복습 사이에 새 단어를 고르게(Anki 「복습과 섞기」)
  // 「복습 전 · 복습 후」 = 새 단어를 복습 전에 · 후에(Anki 「Show before/after reviews」 — 오너 2026-11-01 KST 「혼합 / 복습 전 / 복습 후」).
  Object.freeze({ id: 'new-first', label: '복습 전' }), // 새 단어를 복습 전에
  Object.freeze({ id: 'review-first', label: '복습 후' }), // 새 단어를 복습 후에
]);
// 「하루」 줄 칩 — 10 · 15 · 20 · 30 · ∞ · ⋯ 여섯 칸(위 「순서」 세 칸의 두 배라 칸 경계가 한 칸 걸러 같은 세로선). ∞ = 「제한 없음」(9999),
// ⋯(U+22EF, 숫자 · ∞와 같은 높이) = 직접 입력(0–999). 기호는 화면 읽기에 이름으로 읽힌다(aria).
export const LEVEL_NEW_PER_DAY_PRESETS = Object.freeze([10, 15, 20, 30, NEW_PER_DAY_UNLIMITED]);
export const LEVEL_NEW_PER_DAY_CUSTOM = 'custom';
/** 「하루」 칩 — value = 지금 하루 새 단어 수. 고르기 값이 아니면 ⋯ 칩이 그 숫자로 바뀌어 선택된다(「25」 · 화면 읽기 「직접 입력 25개」). */
export function levelNewPerDayItems(value) {
  const custom = Number.isInteger(value) && !LEVEL_NEW_PER_DAY_PRESETS.includes(value);
  return [
    ...LEVEL_NEW_PER_DAY_PRESETS.map((n) => (n === NEW_PER_DAY_UNLIMITED ? { id: n, label: '∞', aria: '제한 없음', sym: true } : { id: n, label: String(n) })),
    custom ? { id: LEVEL_NEW_PER_DAY_CUSTOM, label: String(value), aria: `직접 입력 ${value}개` }
      : { id: LEVEL_NEW_PER_DAY_CUSTOM, label: '⋯', aria: '직접 입력', sym: true },
  ];
}
/** 직접 입력 판정 — 숫자만 0–999(정본 isNewPerDayValue · NEW_PER_DAY_MAX). 그 이상은 ∞ 칩이다. 반환 = 정수 또는 null. */
export function parseNewPerDayInput(text) {
  const t = String(text ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= NEW_PER_DAY_MAX && isNewPerDayValue(n) ? n : null;
}

// 한 단어 모드가 기본. 리스트는 아직 채점하지 않은 카드를 한 번에 page장(20)까지 펼친다 — 고르는 칸은 없앴다(고정).
export const LEVEL_WORD_PREFS = Object.freeze({ mode: 'one', tone: true, page: 20, order: 'mix', v: 2 });

export function normalizeLevelWordPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: p.mode === 'list' ? 'list' : 'one',
    tone: LEVEL_WORD_PREFS.tone, // 고정 — 저장값(false)은 읽지 않는다
    page: LEVEL_WORD_PREFS.page, // 고정 — 예전 10 · 50도 20으로
    order: LEVEL_STUDY_ORDERS.some((o) => o.id === p.order) ? p.order : LEVEL_WORD_PREFS.order,
    v: 2,
  };
}

/** 세션 줄에 넘길 옵션 — 순서만(하루 새 단어 몫은 화면이 서버 몫으로 따로 넘긴다). */
export const levelStudyOptions = (prefs) => ({ order: LEVEL_STUDY_ORDERS.some((o) => o.id === prefs?.order) ? prefs.order : 'mix' });
// 진행 줄의 학습 옵션 요약 칩(「새 단어 먼저 · 10개」)은 없앴다(LEVEL-WAIT-001 · 오너 결정 2026-11-01 KST) — 옵션은 제목 ▾ 시트에서만 본다.

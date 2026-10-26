/**
 * 목표 창(GOAL-SHEET-001 — 오너 승인 목업 2026-10-26 KST 「언어 지정하고 시험 종류 고르고 날짜 고르도록」 · 「권장대로」) — 순수 계산.
 *
 *   ① 언어   일본어 · 중국어 · 영어 · 프랑스어
 *   ② 시험   N5 … N1 · 「시험 없이」          (시험 일정이 없는 언어는 「목표 수준」 — 과정 레벨)
 *   ③ 날짜   그 급수의 시험 날짜 카드 · 다른 날짜 · 직접 입력(날짜 + 이름)
 *
 * 저장 길은 예전 목표 창 그대로다(profiles dday_date · dday_label · goal_lang · goal_level · goal_review · goal_words — 새 열 · 새 표 없음).
 * 화면은 여기서 고른 값을 persist(날짜, 이름, 언어, 레벨) · persistDaily()에 그대로 넘긴다. 무엇을 넘길지는 goalSaveArgs 하나가 정한다.
 */
import { LANG_NAME_KO } from './constants.js';
import { EXAM_KINDS, EXAM_SCHEDULES, examCardGoal, examDateCards, examDayLabel } from './examSchedules.js';
import { dDayLabel, learnLanguages } from './learnDashboard.js';

/** 언어 칩 순서(목업). 과정 목록에 없는 언어는 빠지고, 목록에만 있는 언어는 뒤에 붙는다. */
export const GOAL_LANG_ORDER = Object.freeze(['Japanese', 'Chinese', 'English', 'French']);
/** ② 「시험 없이」 — 시험 언어에서 날짜만 정한다(목표 과정 없음). */
export const NO_EXAM = 'none';
/** ③ 「다른 날짜」 — 시험 급수를 골랐지만 시험 날이 아닌 날을 목표로(그 급수의 과정은 그대로). */
export const CUSTOM_DATE = 'custom';
/** 이름 칸 길이 — 예전 창 · examGoalOf와 같은 12자. */
export const GOAL_LABEL_MAX = 12;

/** 언어 칩 — 과정 목록(/api/goal-catalog)의 언어. 목록을 받기 전 · 못 받았을 때는 네 트랙. */
export function goalLanguages(catalog) {
  const keys = (catalog ? Object.keys(catalog) : GOAL_LANG_ORDER).filter(lang => LANG_NAME_KO[lang]);
  return [...GOAL_LANG_ORDER.filter(lang => keys.includes(lang)), ...keys.filter(lang => !GOAL_LANG_ORDER.includes(lang))];
}

/** 그 언어의 시험(대조한 일정이 한 줄이라도 있을 때만) — 'JLPT' · 'HSK' · null. */
export function examKindOf(lang, schedules = EXAM_SCHEDULES) {
  return Object.keys(EXAM_KINDS).find(k => EXAM_KINDS[k].lang === lang && schedules.some(r => r.exam === k)) || null;
}

/** ② 시험 급수 칩 — 「N3」 · 「4급」 · 「7–9급」(이름에서 시험 이름을 뗀다). */
export function examLevelChips(exam) {
  return (EXAM_KINDS[exam]?.levels || []).map(lv => ({ key: lv.key, text: lv.name.replace(`${exam} `, '') }));
}

/** ② 목표 수준 칩 — 챕터가 있는 과정 레벨만(어휘 전용 레벨을 목표로 잡으면 계획이 빈다). 오리엔테이션(OT · 프랑스어 A0)은 「입문」. */
export function courseLevelChips(catalog, lang) {
  return ((catalog?.[lang]?.levels) || []).filter(lv => (lv.chapters || []).length > 0)
    .map(lv => ({ key: lv.key, text: (lv.short || lv.key) === 'OT' ? '입문' : lv.short || lv.key }));
}

/** ③ 날짜 카드 — 같은 날 IBT · PBT를 합친 카드에 D 표기를 붙인다(진행바 칸과 같은 dDayLabel). */
export function goalDateCards(exam, level, nowMs = Date.now(), schedules = EXAM_SCHEDULES) {
  if (!exam || !level || level === NO_EXAM) return [];
  return examDateCards(schedules, exam, level, nowMs).map(card => ({ ...card, dLabel: dDayLabel(card.date, nowMs) }));
}

/** 지금 목표 칸 — 「JLPT N3 / 12월 6일 일요일 / D-41」. 이름이 없으면 「목표일」. 날짜 목표가 없으면 null. */
export function goalNowView(dday, nowMs = Date.now()) {
  const day = examDayLabel(dday?.date);
  if (!day) return null;
  return { name: (dday.label || '').trim() || '목표일', day, dLabel: dDayLabel(dday.date, nowMs) };
}

/**
 * 창을 열 때의 고른 값 — 저장된 목표를 그대로 비춘다.
 * 언어 = 저장한 목표 언어 → 첫 학습 언어 → 첫 칩. 시험 언어면 저장한 레벨(없으면 이름 「JLPT N3…」)의 급수를 고르고,
 * 목표일이 그 급수의 시험 날이면 그 카드, 아니면 「다른 날짜」. 급수를 모르는 날짜 목표는 「시험 없이」.
 */
export function initialGoalState({ profile, dday, catalog, nowMs = Date.now() }) {
  const langs = goalLanguages(catalog);
  const savedLang = profile?.goal_lang || '';
  const savedLevel = profile?.goal_level || '';
  const lang = [savedLang, learnLanguages(profile)[0]].find(l => l && langs.includes(l)) || langs[0];
  const base = { lang, pick: '', card: '', date: dday?.date || '', label: dday?.label || '', touched: false };
  const exam = examKindOf(lang);
  if (!exam) return { ...base, pick: savedLang === lang ? savedLevel : '' };
  const levels = EXAM_KINDS[exam].levels;
  const lv = (savedLang === lang && levels.find(x => x.goal && x.goal === savedLevel))
    || (dday?.label ? levels.find(x => dday.label.startsWith(x.name)) : null);
  if (!lv) return dday?.date ? { ...base, pick: NO_EXAM } : base;
  if (!dday?.date) return { ...base, pick: lv.key };
  const cards = goalDateCards(exam, lv.key, nowMs);
  const match = cards.find(c => c.date === dday.date);
  return { ...base, pick: lv.key, card: match ? match.key : cards.length ? CUSTOM_DATE : '' };
}

/** ③에 날짜 · 이름 입력칸을 펴는가 — 시험이 없는 언어 · 「시험 없이」 · 일정이 아직 없는 급수 · 「다른 날짜」. */
export function needsManualDate(state, nowMs = Date.now()) {
  const exam = examKindOf(state.lang);
  if (!exam || state.pick === NO_EXAM) return true;
  if (!state.pick) return false;
  return state.card === CUSTOM_DATE || goalDateCards(exam, state.pick, nowMs).length === 0;
}

/** 고른 값 → persist 인자 [날짜, 이름, 언어, 레벨]. 날짜가 정해지지 않았으면 null. */
export function resolveGoal(state, nowMs = Date.now()) {
  const exam = examKindOf(state.lang);
  const label = (state.label || '').trim().slice(0, GOAL_LABEL_MAX);
  if (exam && state.pick && state.pick !== NO_EXAM) {
    const kind = EXAM_KINDS[exam];
    const lv = kind.levels.find(x => x.key === state.pick);
    if (!lv) return null;
    const card = goalDateCards(exam, lv.key, nowMs).find(c => c.key === state.card);
    if (card) {
      const g = examCardGoal(card, lv.key);
      return [g.date, g.label, g.lang, g.level];
    }
    if (!state.date || !needsManualDate(state, nowMs)) return null;
    // 시험 날이 아닌 날짜 — 급수의 과정은 그대로, 이름을 비우면 급수 이름(「JLPT N3」).
    return [state.date, label || lv.name, lv.goal ? kind.lang : '', lv.goal || ''];
  }
  if (exam && state.pick !== NO_EXAM) return null; // ② 를 아직 고르지 않았다
  if (!state.date) return null;
  if (exam) return [state.date, label, '', '']; // 시험 없이 — 날짜만(목표 과정 없음)
  return [state.date, label, state.pick ? state.lang : '', state.pick || ''];
}

/**
 * 「저장」이 할 일 — { kind: 'persist', args } · { kind: 'daily' } · null(누를 것 없음, 단추를 끈다).
 * ⑴ 날짜 목표를 건드리지 않았으면 예전 창이 열 때 채워 둔 값 그대로 다시 저장한다(예전: persist(date, label.trim(), goalLang, goalLang ? goalLevel : '')).
 * ⑵ 고른 값이 날짜까지 정해졌으면 그것. ⑶ 아니면 하루 목표만(날짜 목표는 그대로) — 바꾼 것이 있을 때만.
 */
export function goalSaveArgs({ state, dday, profile, dailyChanged = false, nowMs = Date.now() }) {
  if (!state.touched && dday?.date) {
    const lang = profile?.goal_lang || '';
    return { kind: 'persist', args: [dday.date, (dday.label || '').trim(), lang, lang ? profile?.goal_level || '' : ''] };
  }
  const goal = resolveGoal(state, nowMs);
  if (goal) return { kind: 'persist', args: goal };
  return dailyChanged ? { kind: 'daily' } : null;
}

/** 목표 지우기 — 예전 「삭제」와 같은 인자. */
export const CLEAR_GOAL_ARGS = Object.freeze(['', '', '', '']);

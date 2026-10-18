/**
 * 배움 · 현황 대시보드 — 순수 계산 (LEARN-HOME-AK-001, 오너 확정 목업 2026-10-09).
 *
 * 화면이 숫자 · 문구를 다시 짓지 않게 표시 재료만 여기서 만든다. 계산 정본은 그대로 쓴다:
 * 목표 궤도 = goalPace.pace · studyPlan.buildPlan/markProgress, 연속 = profiles.streak_count ·
 * streak_freeze_count(learningActivity), 복습 개수 = reviewScope.countReviewScope(화면 호출 지점).
 * 언어 이름은 정본 LANG_NAME_KO만 쓴다 — 국기는 쓰지 않는다(D-X6, 2026-10-12).
 */
import { LANG_NAME_KO, detectLang } from './constants.js';
import { kstDayStartMs } from './growthStats.js';
import { perDayLabel } from './goalPace.js';

export const LEARN_LANGS = Object.freeze(Object.keys(LANG_NAME_KO));
export const LEARN_LANG_KEY = 'learn_lang';

/**
 * 이어 읽기 칸의 장식 글자(learn-resume__glyph) — 언어별 한 글자, 언어를 모르면 「文」.
 * 손님은 학습 언어가 늘 일본어라(learnLanguages(null) = ['Japanese']) 손님 글자는 서버도 안다 — 대기 골격이 같은 글자를
 * 첫 그림부터 그린다(HOME-GLYPH-LCP-001). 대기 화면(loading.jsx · 서버 컴포넌트)도 같은 값을 써서 평범한 모듈에 둔다.
 */
export const RESUME_GLYPH = Object.freeze({ Japanese: 'あ', Chinese: '汉', English: 'A', French: 'É' });
export const GUEST_RESUME_GLYPH = RESUME_GLYPH.Japanese;

/**
 * 학습 언어 칩 목록 — 프로필 학습 언어(배열 · 문자열) 중 이름이 있는 언어. 학습 언어가 비어 있으면 담은 표현이 많은
 * 언어 순(복습방 기본 언어 규칙 — REV-SCOPE-R1A §9-4와 같은 결), 그것도 없으면 일본어.
 */
export function learnLanguages(profile, vocabCounts = null) {
  const raw = profile?.learning_language;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(lang => LEARN_LANGS.includes(lang));
  if (list.length) return [...new Set(list)];
  const saved = Object.entries(vocabCounts || {}).filter(([lang, n]) => LEARN_LANGS.includes(lang) && n > 0)
    .sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
  return saved.length ? saved : ['Japanese'];
}

/** 언어 칩 글자 — 정본 이름 사전 하나(새 이름 사전 금지). */
export const learnLangLabel = lang => LANG_NAME_KO[lang] || lang;

export const STREAK_HINT = '쉼: 7일 연속할 때마다 1개(최대 2개). 하루 빠지면 자동으로 써서 연속이 이어져요';

/** 연속 칸 — 「12일 / 연속 · 쉼 2」, 기록이 없으면 「– / 연속」. 방패 같은 그림 기호는 쓰지 않는다(오너 B안). */
export function streakView(profile) {
  const streak = Number(profile?.streak_count) || 0;
  const rest = Number(profile?.streak_freeze_count) || 0;
  const value = streak > 0 ? `${streak}일` : '–';
  const label = streak > 0 && rest > 0 ? `연속 · 쉼 ${rest}` : '연속';
  const said = streak > 0 ? `${streak}일 연속${rest > 0 ? ` · 쉼 ${rest}` : ''}` : '연속 기록 없음';
  return { value, label, aria: `${said} — ${STREAK_HINT}`, title: STREAK_HINT };
}

const isToday = (ts, now) => !!ts && Date.parse(ts) >= kstDayStartMs(now) && Date.parse(ts) < kstDayStartMs(now) + 86400000;

/** 오늘 목표 달성률 — 복습 · 수집 목표 기준(예전 GoalTile 산식 그대로, 완독은 목표 설정만 지원). */
export function todayGoalPct({ vocab = [], projections = [], profile, now = Date.now() } = {}) {
  const goalReview = profile?.goal_review ?? 5;
  const goalWords = profile?.goal_words ?? 5;
  const reviewsToday = projections.filter(p => isToday(p.memory?.lastReview, now)).length;
  const wordsToday = vocab.filter(v => isToday(v.created_at, now)).length;
  return Math.round((Math.min(1, reviewsToday / Math.max(goalReview, 1)) + Math.min(1, wordsToday / Math.max(goalWords, 1))) / 2 * 100);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 'YYYY-MM-DD'(KST) → 「12/6(일)」 */
export function shortDateLabel(date, { weekday = true } = {}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return null;
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).getUTCDay();
  return `${+match[2]}/${+match[3]}${weekday ? `(${WEEKDAYS[day]})` : ''}`;
}

/**
 * 진행바 반쪽 칸의 표시 재료. marked = markProgress 산출, p = pace 산출.
 * 신호: 예상 완주일이 목표일 이전·당일이면 청(여유), 늦으면 적(「N일 늦음」). 예측할 수 없으면 신호 없음.
 * 「완주 예상」 글자는 화면에서 빼고 aria-label에만 남긴다(오너 결정).
 */
export function goalTrackView({ marked, p, goalName, goalDate }) {
  if (!marked || !p) return null;
  const date = shortDateLabel(goalDate);
  const head = [date, goalName].filter(Boolean).join(' ');
  const dLabel = p.daysLeft > 0 ? `D-${p.daysLeft}` : p.daysLeft === 0 ? 'D-Day' : `D+${Math.abs(p.daysLeft)}`;
  const count = { done: marked.done, total: marked.total };
  const pct = marked.total > 0 ? Math.min(100, (marked.done / marked.total) * 100) : 0;
  if (p.done) {
    return { head, dLabel, eta: null, signal: 'go', count, pct: 100, caption: '계획한 과를 다 마쳤어요',
      aria: `${goalName} ${date}까지 ${count.done}/${count.total}과, 계획한 과를 다 마쳤어요` };
  }
  const gap = p.gapDays;
  const gapLabel = gap == null ? null : gap < 0 ? `${Math.abs(gap)}일 여유` : gap > 0 ? `${gap}일 늦음` : '딱 맞음';
  const signal = gap == null ? null : gap > 0 ? 'stop' : 'go';
  const eta = p.etaDate ? shortDateLabel(p.etaDate, { weekday: false }) : null;
  const caption = eta ? `하루 ${perDayLabel(p.actualPerDay)}과 · ${gapLabel}` : `하루 ${perDayLabel(p.needPerDay)}과 필요`;
  const days = p.daysLeft >= 0 ? `${p.daysLeft}일` : `기한 ${Math.abs(p.daysLeft)}일 지남`;
  const aria = eta
    ? `${goalName} ${date}까지 ${days}, ${count.done}/${count.total}과, 하루 ${perDayLabel(p.actualPerDay)}과면 ${eta} 완주 예상, ${gapLabel}`
    : `${goalName} ${date}까지 ${days}, ${count.done}/${count.total}과, 하루 ${perDayLabel(p.needPerDay)}과 필요, 최근 2주 진도가 없어 완주 예상일은 아직 몰라요`;
  return { head, dLabel, eta, signal, count, pct, caption, aria };
}

/** 서재 자료가 이 언어인가. 언어를 모르는 자료는 어느 칩에서도 잃지 않게 받는다. */
export function materialInLang(row, lang) {
  const known = row?.reading_materials?.language || null;
  return !known || known === lang;
}

/** 단어 행의 언어(저장값 우선, 없으면 표기로 판정) — 배움 칸의 단어 순환을 칩 언어로 거른다. */
export const vocabLang = word => word?.language || detectLang(word?.word_text || '');

/**
 * 오늘 문단 칸 상태 — 준비된 문단(48시간 이내 prefetched)의 첫 문장 → 넣을 복습 표현(예보 상위 3) → 신규 안내.
 */
export function paragraphState({ sentence, forecastWords }) {
  if (typeof sentence === 'string' && sentence.trim()) return { kind: 'ready', sentence: sentence.trim() };
  if (Array.isArray(forecastWords) && forecastWords.length) return { kind: 'forecast', words: forecastWords.slice(0, 3) };
  return { kind: 'empty' };
}

export const PREFETCH_WINDOW_MS = 48 * 3600 * 1000;

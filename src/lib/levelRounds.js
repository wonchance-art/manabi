// 단어 목록 바퀴 답(LEVEL-ROUND-001 — 설계 「단어장 여러 바퀴」 2판 1번 · H 계약, 오너 「구현 개시」 2026-10-19 KST).
// 목록의 O · X를 상태(아는 단어 · 공부 중 · 탭 표시)와 별도로 「이번 바퀴의 답」으로도 한 건씩 남긴다 — review_events source 'level'.
// 바퀴 답은 활동 기록일 뿐이다: FSRS 일정 · 정답률 · 다이얼에 닿지 않는다(ACTIVITY_ONLY_SOURCES, Anki 필터 덱 선례).
// 기록 규칙은 한자 탭(hanziSession)과 같다: 답은 곧바로 쓰지 않고 「대기」로 들고 있다가 다른 카드의 답 · 화면을 떠날 때 확정한다.
// 그래서 방금 누른 O · X를 다시 눌러 취소하면 기록이 늘지 않는다. 확정 뒤의 취소만 취소 줄(detail.cancel)을 남긴다(표는 append-only).
import { kstDateString, kstDayStartMs } from './growthStats';
import { learningDay } from './fsrsScheduler';
import { shuffleHanzi } from './hanziSession';
import { normalizeKnownWord } from './knownWordControl';

export const LEVEL_SOURCE = 'level';
const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export const levelAnswerKey = (word, view) => `${normalizeKnownWord(word)}|${view}`;
const keyOf = levelAnswerKey;

/**
 * 같은 날 규칙 — 같은 학습일(04:00 KST 경계 — 복습 기한 · 새 단어 몫과 같은 날, 2026-10-25 KST. 그 전은 KST 자정)
 * 다른 보기에서 이미 답한 단어의 답은 sameDay(설계 B · 「같은 날 다른 탭의 O」).
 * 단기 기억으로 누른 O일 수 있어 「잊은 수 · 졸업 · 탭 완료 · 아는 단어로?」에서 세지 않는다. 막지는 않는다.
 * @param {Map<string, {correct: boolean, at: number}>} answers lastLevelAnswers 결과(+ 이 화면에서 누른 답)
 */
export function isSameDayAnswer(answers, word, view, nowMs = Date.now()) {
  const day = learningDay(nowMs);
  const head = `${normalizeKnownWord(word)}|`;
  for (const [key, answer] of answers || []) {
    if (!key.startsWith(head) || key === head + view) continue;
    if (Number.isFinite(answer?.at) && learningDay(answer.at) === day) return true;
  }
  return false;
}

/**
 * 단어 · 보기마다 **마지막** 바퀴 답. rows는 최신 순(created_at desc)이어야 한다. 취소 줄이 마지막이면 답 없음.
 * @returns {Map<string, {correct: boolean, at: number, sameDay: boolean}>} 키 = `${단어}|${보기}`
 */
export function lastLevelAnswers(rows) {
  const seen = new Set();
  const answers = new Map();
  for (const r of rows || []) {
    const view = r?.detail?.view;
    if (!r?.item_key || !view || typeof r.correct !== 'boolean') continue;
    const key = keyOf(r.item_key, view);
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.detail.cancel) continue;
    answers.set(key, { correct: r.correct, at: Date.parse(r.created_at), sameDay: r.detail.sameDay === true });
  }
  return answers;
}

export const levelAnswerOf = (answers, word, view) => answers?.get(keyOf(word, view)) || null;

/**
 * 이 레벨의 바퀴 답 전부(최신 순) — 1,000행 페이지로 끝까지(REVIEW-ROWS-CAP-001: PostgREST는 1000행에서 말없이 자른다).
 * untilIso로 상한을 고정해 읽는 사이 새 기록이 페이지를 밀지 않게 한다. 오류면 reject.
 */
export async function fetchLevelAnswers(client, userId, { lang, level, page = 1000, untilIso = new Date().toISOString(), sinceIso = null }) {
  const rows = [];
  for (let from = 0; ; from += page) {
    // sinceIso = 이 기기에 이미 받아 둔 줄의 끝(네 영역 체크의 이어 읽기) — 그 시각부터(같은 시각 줄은 부르는 쪽이 id로 거른다). 없으면 처음부터.
    const { data, error } = await client.from('review_events').select('id, item_key, correct, detail, created_at')
      .eq('user_id', userId).eq('source', LEVEL_SOURCE).eq('lang', lang).eq('detail->>level', level)
      .gte('created_at', sinceIso || EPOCH_ISO).lte('created_at', untilIso)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('level_answers_unavailable');
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

/** 기록할 이벤트 한 건. 1판은 바퀴 표가 없어 지금까지의 답이 모두 1바퀴다(설계 B 「바퀴 줄이 없으면 1바퀴」). */
export function levelAnswerEvent({ lang, word, level, view, correct, sameDay = false, round = 1, at = Date.now() }) {
  return { lang, source: LEVEL_SOURCE, item_key: word, correct, created_at: new Date(at).toISOString(),
    detail: { level, view, round, sameDay } };
}

/** 확정된 답을 취소하는 줄 — 마지막 줄이 이것이면 그 단어 · 보기는 답 없음(lastLevelAnswers). */
export function levelCancelEvent({ lang, word, level, view, round = 1, at = Date.now() }) {
  return { lang, source: LEVEL_SOURCE, item_key: word, correct: false, created_at: new Date(at).toISOString(),
    detail: { level, view, round, cancel: true } };
}

/**
 * 대기 → 확정 큐. 대기는 한 건뿐이다: 다른 단어 · 보기의 답이 오면 앞의 대기를 확정(write)한다.
 * cancel(key)은 그 답이 아직 대기 중이면 지우고 true(쓸 것 없음), 이미 확정됐으면 false(부르는 쪽이 취소 줄을 쓴다).
 */
export function createLevelAnswerQueue(write) {
  let pending = null; // { key, event }
  return {
    answer(word, view, event) {
      const key = keyOf(word, view);
      if (pending && pending.key !== key) write(pending.event);
      pending = { key, event };
    },
    cancel(word, view) {
      if (pending?.key !== keyOf(word, view)) return false;
      pending = null;
      return true;
    },
    flush() {
      if (!pending) return;
      const { event } = pending;
      pending = null;
      write(event);
    },
    get pending() { return pending?.event || null; },
  };
}

/** 이 화면의 답을 Map에 반영(낙관적) — 답이면 넣고, 취소면 뺀다. */
export function applyLevelAnswer(answers, word, view, answer) {
  const next = new Map(answers);
  if (answer) next.set(keyOf(word, view), answer); else next.delete(keyOf(word, view));
  return next;
}

// ── 바퀴(LEVEL-ROUND-001 ② — 설계 2판 B · G 2번) ─────────────────────────────────────────────
// 바퀴 줄(user_level_rounds) = 보기마다 「몇 번째 바퀴가 언제 어떤 범위로 시작했나」. 답은 started_at 뒤의 것만 이번 바퀴다.
// 줄이 없으면(표 미적용 · 아직 새 바퀴를 안 시작함) 지금까지의 답 전부가 1바퀴다 — 화면은 지금(상태 기준)처럼 그린다.

export const LEVEL_ROUNDS_TABLE = 'user_level_rounds';
const ROUND_WORDS = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
/** 「두 바퀴째」 — 공부 화면 숫자는 하나(오너 2026-10-16)라 바퀴는 글로 쓴다. 열을 넘으면 숫자. */
export const roundLabel = (n) => `${ROUND_WORDS[n - 1] || n} 바퀴째`;

/** 보기의 지금 바퀴 — { round, scope, startedAt(ms | null), recorded }. */
export function currentLevelRound(roundRows, view) {
  let best = null;
  for (const r of roundRows || []) if (r?.view === view && (!best || r.round_no > best.round_no)) best = r;
  if (!best) return { round: 1, scope: 'all', startedAt: null, recorded: false };
  return { round: best.round_no, scope: best.scope === 'missed' ? 'missed' : 'all', startedAt: Date.parse(best.started_at), recorded: true };
}

/** rows(최신 순)를 시각으로 자른다 — since 이상 · before 미만. */
export function levelRowsBetween(rows, { since = null, before = null } = {}) {
  return (rows || []).filter((r) => {
    const t = Date.parse(r?.created_at);
    return Number.isFinite(t) && (since == null || t >= since) && (before == null || t < before);
  });
}

/**
 * 이번 바퀴 범위(단어 키 Set). 전부 = 레벨 전체. 모른 것만 = 바퀴 시작 직전 그 보기의 마지막 답이 X인 단어,
 * 답이 없던 단어는 지금 상태(stateMissed — 전체 보기 = 공부 중, 탭 = 그 탭 X)로 본다(1바퀴는 답 기록 이전에도 있었으니까).
 */
export function levelRoundScope(keys, round, { before, stateMissed } = {}) {
  if (round.scope !== 'missed') return new Set(keys);
  const out = new Set();
  for (const key of keys) {
    const last = before?.get(key);
    if (last ? last.correct === false : stateMissed?.has(key)) out.add(key);
  }
  return out;
}

/** 이번 바퀴 진도 — 범위 중 답한 수 · O · X · 남은 수. answers = 단어 → 답(이번 바퀴). */
export function levelRoundProgress(scope, answers) {
  let known = 0, studying = 0;
  for (const key of scope) {
    const a = answers.get(key);
    if (a?.correct === true) known += 1;
    else if (a?.correct === false) studying += 1;
  }
  const total = scope.size;
  return { total, known, studying, left: total - known - studying };
}

/** 잊은 수(LEVEL-ROUND-001 ③) — 바퀴 시작 전 마지막 답이 O(같은 날 다른 탭의 O 제외)였는데 이번 바퀴에 X인 단어 수. 둘 다 단어 → 답. */
export function levelForgotten(before, current) {
  let n = 0;
  for (const [key, a] of current || []) {
    const b = before?.get(key);
    if (a?.correct === false && b?.correct === true && !b.sameDay) n += 1;
  }
  return n;
}

/**
 * 바퀴 순서(LEVEL-ROUND-001 ③) — 1바퀴는 교재 순서, 2바퀴부터 섞는다(위치로 외우기 방지). 섞기는 한자 탭과 같은 shuffleHanzi 하나,
 * 씨앗은 바퀴 번호 — 새로고침 · 다른 기기에서도 같은 바퀴는 같은 순서.
 */
export function levelRoundOrder(entries, { seed, round }) {
  if (!(round >= 2)) return entries;
  let h = 2166136261; // FNV-1a → mulberry32
  for (const ch of `${seed}|${round}`) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return shuffleHanzi(entries, rand);
}

/** 「처음부터 전부」 간격(일) — 직전 「전부」 바퀴 끝에서 1주 → 1달 → 3달, 그 뒤로는 3달. 바꾸려면 여기 한 곳만(설계 I). */
export const LEVEL_ROUND_SPACING_DAYS = Object.freeze([7, 30, 90]);
/** 끝 카드가 권하는 다음 보기 — 알아보기 → 뜻 보고 떠올리기 → 소리(설계 2판 3번). 소리 다음은 권하지 않는다. */
export const LEVEL_NEXT_VIEW = Object.freeze({ all: 'meaning', word: 'meaning', sentence: 'meaning', meaning: 'audio', audio: null });
const DAY_MS = 86_400_000;

/**
 * 다음 「처음부터 전부」 권장 시각 — 「전부」 바퀴만 센다(「모른 것만」은 간격에 넣지 않음). 줄 없는 1바퀴도 「전부」다.
 * 직전 「전부」 바퀴의 끝 = 그 뒤 바퀴의 시작, 뒤 바퀴가 없으면 endedAt(지금 바퀴의 마지막 답). 모르면 null.
 */
export function nextFullRoundAt(roundRows, view, endedAt, exam = null) {
  const mine = (roundRows || []).filter((r) => r?.view === view).sort((a, b) => a.round_no - b.round_no);
  if (!mine.length || mine[0].round_no > 1) mine.unshift({ round_no: 1, scope: 'all' });
  let fulls = 0, last = -1;
  mine.forEach((r, i) => { if (r.scope !== 'missed') { fulls += 1; last = i; } });
  const end = mine[last + 1] ? Date.parse(mine[last + 1].started_at) : endedAt;
  if (!Number.isFinite(end)) return null;
  const usual = end + LEVEL_ROUND_SPACING_DAYS[Math.min(fulls, LEVEL_ROUND_SPACING_DAYS.length) - 1] * DAY_MS;
  if (!exam) return usual;
  // 시험 모드(J) — 사다리의 다음 칸(직전 「전부」 끝에서 2일 이상 뒤)과 평소 간격 중 이른 쪽. 총정리(D-3)를 넘기면 null(안내만).
  const from = kstDayStartMs(end) + 2 * DAY_MS;
  const step = LEVEL_EXAM_LADDER_DAYS.map((d) => exam.examMs - d * DAY_MS).find((t) => t >= from);
  return step == null ? null : Math.min(usual, step);
}

/**
 * 시험 모드 사다리(J, 오너 「HSK 시험 앞두고 쭉 확인하는 상황에선?」) — 시험 n일 전마다 「처음부터 전부」. 시험이 가까울수록 간격이
 * 짧아진다(가장 좋은 간격은 남은 기간에 비례 — Cepeda 외 2008). 마지막 칸 = D-3 총정리. 평소 [7, 30, 90]과 함께 여기 한 곳.
 */
export const LEVEL_EXAM_LADDER_DAYS = Object.freeze([60, 30, 14, 7, 3]);

/**
 * 이 레벨이 시험 범위인가 — 목표 날짜(profiles.dday_date)가 아직 안 왔고, 목표 언어가 같고, 이 레벨이 목표 급수 이하(HSK · JLPT 어휘는
 * 아래 급을 포함한다). 아니면 null — 평소 간격. levels = 그 언어 목록의 급수 순서(쉬운 것부터).
 */
export function levelExamOf(profile, { language, levels, level, nowMs = Date.now() }) {
  const date = String(profile?.dday_date || '');
  if (!language || profile?.goal_lang !== language || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const goal = levels.indexOf(String(profile.goal_level || '').toUpperCase());
  const here = levels.indexOf(String(level || '').toUpperCase());
  if (goal < 0 || here < 0 || here > goal) return null;
  const examMs = Date.parse(`${date}T00:00:00+09:00`);
  const daysLeft = Math.round((examMs - kstDayStartMs(nowMs)) / DAY_MS);
  return daysLeft > 0 ? { examMs, daysLeft, level: levels[goal] } : null;
}

/** 시험 모드 끝 카드 안내 두 줄 — 「HSK 4 시험까지 21일 · 다음 바퀴 10월 27일」 · 「마지막 총정리 11월 5일 (뜻 · 소리)」. */
export function levelExamHint({ examName, exam, dueAt, nowMs = Date.now() }) {
  const md = (t) => { const [, m, d] = kstDateString(t).split('-').map(Number); return `${m}월 ${d}일`; };
  const today = kstDayStartMs(nowMs);
  const total = exam.examMs - 3 * DAY_MS;
  const next = dueAt == null || dueAt === total ? '' : kstDayStartMs(dueAt) > today ? ` · 다음 바퀴 ${md(dueAt)}` : ' · 지금 처음부터 전부 돌기 좋아요';
  const last = today < total ? `마지막 총정리 ${md(total)} (뜻 · 소리)`
    : today === total ? '오늘 총정리 — 뜻 · 소리 탭으로 처음부터 전부' : '시험 전까지 총정리에서 모른 것만 다시';
  return [`${examName} 시험까지 ${exam.daysLeft}일${next}`, last];
}

/** 끝 카드의 다음 바퀴 안내 한 줄 — 「다음 바퀴는 뜻 탭으로 — 1주 뒤(10월 25일)부터」. 막지 않고 날짜만 권한다. */
export function levelRoundHint({ nextLabel = null, dueAt, nowMs = Date.now() }) {
  if (dueAt == null) return null;
  const days = Math.round((kstDayStartMs(dueAt) - kstDayStartMs(nowMs)) / DAY_MS);
  const [, m, d] = kstDateString(dueAt).split('-').map(Number);
  const date = `${m}월 ${d}일`;
  if (days <= 0) return nextLabel ? `다음 바퀴는 ${nextLabel} 탭으로 — 지금 돌아도 좋아요` : '처음부터 전부 다시 돌 때예요';
  const when = days === 1 ? '내일부터' : days % 7 === 0 && days < 28 ? `${days / 7}주 뒤(${date})부터` : `${date}부터`;
  return nextLabel ? `다음 바퀴는 ${nextLabel} 탭으로 — ${when}` : `처음부터 전부는 ${when}`;
}

/** 하루 분량(LEVEL-ROUND-001 ④) — 이 기기에서 오늘(KST) 목록으로 새로 담은 수. */
export const LEVEL_SAVES_KEY = 'manabi:level-saves-today';
/**
 * 담기 하나를 세고, 오늘 담은 수가 복습의 남은 새 카드 자리(quota = reviewScopeQuota — 복습 설정 dailyNewLimit · 계정 한도의 정본)를
 * 넘었으면 true — 하루 한 번만. 막지 않고 알리기만 한다. quota를 모르면(읽기 전 · 실패) 세기만 한다.
 */
export function countLevelSave(storage, quota, nowMs = Date.now()) {
  const day = kstDateString(nowMs);
  let cur = null;
  try { cur = JSON.parse(storage.getItem(LEVEL_SAVES_KEY) || 'null'); } catch { cur = null; }
  const today = cur?.day === day;
  const n = (today && Number.isInteger(cur.n) ? cur.n : 0) + 1;
  const told = today && cur.told === true;
  const over = !!quota && Number.isInteger(quota.remaining) && n > quota.remaining;
  storage.setItem(LEVEL_SAVES_KEY, JSON.stringify({ day, n, told: told || over }));
  return over && !told;
}

/** 단어 · 보기 키 Map → 한 보기의 단어 → 답 Map. */
export function levelAnswersOfView(answers, view) {
  const out = new Map();
  const tail = `|${view}`;
  for (const [key, a] of answers || []) if (key.endsWith(tail)) out.set(key.slice(0, -tail.length), a);
  return out;
}

const isMissingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code) || /user_level_rounds/.test(error?.message || '') && /does not exist|schema cache/.test(error?.message || '');

/** 이 레벨의 바퀴 줄 — { available, rows }. 표가 없으면 available=false(화면은 1바퀴로 물러선다), 다른 오류는 reject. */
export async function fetchLevelRounds(client, userId, { lang, level }) {
  const { data, error } = await client.from(LEVEL_ROUNDS_TABLE).select('view, round_no, scope, started_at')
    .eq('user_id', userId).eq('lang', lang).eq('level', level).order('round_no', { ascending: true });
  if (error) { if (isMissingTable(error)) return { available: false, rows: [] }; throw error; }
  return { available: true, rows: Array.isArray(data) ? data : [] };
}

export async function insertLevelRounds(client, userId, { lang, level }, rounds) {
  const rows = rounds.map((r) => ({ user_id: userId, lang, level, view: r.view, round_no: r.round_no, scope: r.scope, started_at: r.started_at }));
  const { error } = await client.from(LEVEL_ROUNDS_TABLE).insert(rows);
  if (error) throw error;
  return rows;
}

/** 바퀴 줄 지우기 — views가 없으면 이 레벨 전부, 있으면 그 보기 · 바퀴 번호(round_no)만. */
export async function deleteLevelRounds(client, userId, { lang, level }, { view = null, round = null } = {}) {
  let q = client.from(LEVEL_ROUNDS_TABLE).delete().eq('user_id', userId).eq('lang', lang).eq('level', level);
  if (view) q = q.eq('view', view);
  if (round) q = q.eq('round_no', round);
  const { error } = await q;
  if (error) throw error;
}

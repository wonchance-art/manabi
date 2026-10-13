// 뷰어 v2 AD-R3 PR④ — 단어 경계 규칙(② 「내 다른 자료에도」 user_segment_rules · ③ 「모든 사용자」 shared_segment_rules) 순수 함수.
// 정본: docs/manabi-viewer-v2-ad-r3.md §5.1 · §5.2 · §5.3 · §8.1(segmentRules.test.js). 표 DDL = docs/sql/segment-rules.sql.
//
// · 규칙 = {language, surface, cuts}. surface는 규칙 꼴(중·일 = 공백 없는 표면, 영어 = 소문자 · 단어 사이 공백 하나),
//   cuts는 surface의 **공백 뺀** 글자 위치(UTF-16) 칼선이다. [] = 한 단어로 묶기, [칼선…] = 나누기.
// · 적용(§5.1): 묶기 규칙은 줄의 공백 뺀 글자에서 surface가 나오고 **양 끝이 분석기 토큰 경계와 맞을 때만**(안쪽 토큰 2개 이상).
//   나누기 규칙은 **토큰 표면이 surface와 정확히 같을 때만**. 긴 surface부터, 겹치면 먼저 맞은 것이 이긴다. 결정적이다.
// · 결과는 boundaryEdits.applyBoundaryLayers가 받는 기록 모양 {id, start, end, text, cuts}(줄 좌표)이다 — 적용 · 조각 필드 ·
//   표식(user_rule · shared_rule)은 「이 자료」 경계와 같은 함수가 만든다(새 적용 경로 0).
// · cuts 값 검사(0 < c < 길이, 오름차순, 서로게이트 안쪽 금지, 영어는 단어 사이만)는 DDL CHECK 대신 여기서 한다(§5.3).
//   쓰기(화면 · 관리자 라우트)와 읽기(분석) 모두 같은 validateSegmentRule을 지나므로, 표에 어긋난 행이 있어도 적용되지 않는다.
// · 표가 없으면(PGRST205 · 42P01) 규칙 없이 그대로 간다 — 롤백해도 분석이 깨지지 않는다(segmentRulesTableMissing).
// 브라우저 · 서버 공용 — 서버 전용 모듈 · Node 내장을 import하지 않는다.
import { BOUNDARY_LANGUAGES, boundarySpans, compactBoundaryText } from './boundaryEdits';

export const SEGMENT_RULE_LANGUAGES = BOUNDARY_LANGUAGES;
// DDL CHECK와 같은 값: surface 2~40자(코드 포인트 — Postgres length) · 칼선 39개 이하. 읽기 상한은 분석 요청당 표마다 500행.
export const SEGMENT_RULE_LIMITS = Object.freeze({ minChars: 2, maxChars: 40, maxCuts: 39, maxRows: 500 });
export const SEGMENT_RULE_TABLES = Object.freeze({ user: 'user_segment_rules', shared: 'shared_segment_rules' });

/** PostgREST 「표 없음」(PGRST205 — 스키마 캐시에 없음) · Postgres 42P01(undefined_table). */
export function segmentRulesTableMissing(error) {
  const code = error?.code;
  return code === 'PGRST205' || code === '42P01';
}

/** 규칙 꼴 정규화: 앞뒤 공백 제거 · NFC · 안쪽 공백은 하나로. 영어는 소문자(대소문자 구분 없이 맞춘다). 중·일은 공백을 모두 지운다. */
export function normalizeSegmentSurface(language, surface) {
  const text = String(surface ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (language === 'English') return text.toLowerCase();
  return compactBoundaryText(text);
}

const isLowSurrogate = code => code >= 0xDC00 && code <= 0xDFFF;

/** 영어 surface의 단어 사이 칼선(공백 뺀 위치). */
function wordCuts(surface) {
  const cuts = [];
  let at = 0;
  surface.split(' ').forEach((word, k) => { if (k) cuts.push(at); at += word.length; });
  return cuts;
}

/**
 * 규칙 하나 검증 · 정규화. {ok:true, rule:{language, surface, key, cuts}} | {ok:false, reason}.
 * key = 맞춰 볼 공백 뺀 꼴(영어는 소문자). reason: language · surface · too_short · too_long · cuts.
 */
export function validateSegmentRule(input) {
  const { language } = input || {};
  if (!SEGMENT_RULE_LANGUAGES.includes(language)) return { ok: false, reason: 'language' };
  if (typeof input.surface !== 'string') return { ok: false, reason: 'surface' };
  const surface = normalizeSegmentSurface(language, input.surface);
  const points = [...surface].length;
  if (points < SEGMENT_RULE_LIMITS.minChars || [...compactBoundaryText(surface)].length < SEGMENT_RULE_LIMITS.minChars) {
    return { ok: false, reason: 'too_short' };
  }
  if (points > SEGMENT_RULE_LIMITS.maxChars) return { ok: false, reason: 'too_long' };
  const key = compactBoundaryText(surface);
  const cuts = input.cuts ?? [];
  if (!Array.isArray(cuts) || cuts.length > SEGMENT_RULE_LIMITS.maxCuts) return { ok: false, reason: 'cuts' };
  let previous = 0;
  for (const cut of cuts) {
    if (!Number.isInteger(cut) || cut <= previous || cut >= key.length || isLowSurrogate(key.charCodeAt(cut))) return { ok: false, reason: 'cuts' };
    previous = cut;
  }
  if (language === 'English') {
    // 영어는 단어 사이에서만 나눈다(planBoundarySplit과 같은 규칙). 공백 없는 한 단어는 규칙이 될 수 없다.
    const words = wordCuts(surface);
    if (!words.length || cuts.some(cut => !words.includes(cut))) return { ok: false, reason: 'cuts' };
  }
  return { ok: true, rule: { language, surface, key, cuts: [...cuts] } };
}

const keyOf = (language, text) => {
  const compact = compactBoundaryText(String(text ?? '').normalize('NFC'));
  return language === 'English' ? compact.toLowerCase() : compact;
};
// 코드 포인트 순 비교(로캘 무관 — 결정적).
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * 표 행 → 적용 순서로 정렬한 규칙 목록(언어가 다르거나 검증에 어긋난 행은 뺀다). 같은 꼴이 두 번 오면 앞의 것.
 * 순서: 공백 뺀 길이가 긴 것부터 → 꼴(코드 포인트) → 칼선 수.
 */
export function compileSegmentRules(rows, language) {
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || (row.language !== undefined && row.language !== language)) continue;
    const checked = validateSegmentRule({ language, surface: row.surface, cuts: row.cuts });
    if (!checked.ok || seen.has(checked.rule.key)) continue;
    seen.add(checked.rule.key);
    out.push({ ...checked.rule, id: typeof row.id === 'string' ? row.id : null });
  }
  return out.sort((a, b) => b.key.length - a.key.length || byCodePoint(a.key, b.key) || a.cuts.length - b.cuts.length);
}

// 규칙이 걸리면 안 되는 토큰: 분석 실패 · 이합사 조각(sep_link)·삽입형(중국어 base_form ≠ text) — §6.1 묶기 조건과 같은 이유.
function blockedToken(token, language) {
  if (!token || token.failed) return true;
  if (language === 'Chinese' && (token.sep_link || (token.base_form && token.base_form !== token.text))) return true;
  return false;
}

/**
 * 한 줄의 분석기 토큰(배열: 토큰 객체 또는 {id, token})에 규칙을 맞춰 기록 목록을 만든다(쓰기 0 · 입력 무변경).
 * 결과 [{id:'rule:<꼴>', start, end, text, cuts}] — 서로 겹치지 않고 줄 앞에서부터 정렬. applyBoundaryLayers 한 층의 edits로 쓴다.
 * 이미 분석기와 같은 경계(한 토큰인 묶기 · 칼선이 같은 나누기)는 만들지 않는다 — 규칙이 없을 때와 같은 결과.
 */
export function segmentRuleEditsForLine(lineTokens, rules, { language } = {}) {
  if (!SEGMENT_RULE_LANGUAGES.includes(language) || !Array.isArray(rules) || !rules.length || !Array.isArray(lineTokens)) return [];
  const entries = lineTokens.map((item, k) => (item && typeof item === 'object' && 'token' in item ? item : { id: k, token: item }));
  const spans = boundarySpans(entries).filter(span => span.end > span.start);
  if (!spans.length) return [];
  const compact = spans.map(span => compactBoundaryText(span.entry.token?.text ?? '')).join('');
  const lineKey = language === 'English' ? compact.toLowerCase() : compact;
  const startAt = new Map(spans.map((span, k) => [span.start, k]));
  const endAt = new Map(spans.map((span, k) => [span.end, k]));
  const taken = [];
  const free = (s, e) => !taken.some(item => item.start < e && item.end > s);
  const out = [];
  for (const rule of rules) {
    if (rule?.language !== language || typeof rule.key !== 'string' || !rule.key) continue;
    const len = rule.key.length;
    if (rule.cuts.length) {
      // 나누기: 토큰 표면 = 규칙 꼴.
      for (const span of spans) {
        if (span.end - span.start !== len || keyOf(language, span.entry.token?.text) !== rule.key) continue;
        if (blockedToken(span.entry.token, language) || !free(span.start, span.end)) continue;
        const record = { id: `rule:${rule.key}`, start: span.start, end: span.end, text: compact.slice(span.start, span.end),
          cuts: rule.cuts.map(cut => span.start + cut) };
        taken.push(record);
        out.push(record);
      }
      continue;
    }
    // 묶기: 줄 꼴에서 surface가 나오는 자리마다 — 양 끝이 토큰 경계이고 안쪽 토큰이 2개 이상일 때만.
    for (let at = lineKey.indexOf(rule.key); at >= 0; at = lineKey.indexOf(rule.key, at + 1)) {
      const first = startAt.get(at), last = endAt.get(at + len);
      if (first === undefined || last === undefined || last <= first || !free(at, at + len)) continue;
      const inside = spans.slice(first, last + 1);
      if (inside.some(span => blockedToken(span.entry.token, language))) continue;
      // 영어: 안쪽 칼선 = 규칙 꼴의 단어 사이(공백) 그대로일 때만 — 「pick up」은 pick|up에만 걸린다.
      if (language === 'English') {
        const inner = inside.slice(0, -1).map(span => span.end - at);
        const words = wordCuts(rule.surface);
        if (inner.length !== words.length || inner.some((cut, k) => cut !== words[k])) continue;
      }
      const record = { id: `rule:${rule.key}`, start: at, end: at + len, text: compact.slice(at, at + len), cuts: [] };
      taken.push(record);
      out.push(record);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** 규칙 묶음 {user:[규칙…], shared:[규칙…]}에 적용할 것이 하나라도 있나. */
export const hasSegmentRules = set => !!set && ((set.user?.length || 0) + (set.shared?.length || 0)) > 0;

/**
 * 한 줄의 규칙 층(applyBoundaryLayers 순서 — 뒤가 이긴다): 공유 규칙 → 사용자 규칙. 「이 자료」 기록 층은 호출 쪽이 맨 뒤에 붙인다.
 * 규칙이 하나도 맞지 않으면 [] — 호출 쪽은 이 줄을 건드리지 않는다.
 */
export function segmentRuleLayers(lineTokens, set, { language } = {}) {
  if (!hasSegmentRules(set)) return [];
  const layers = [];
  const shared = segmentRuleEditsForLine(lineTokens, set.shared, { language });
  if (shared.length) layers.push({ marker: 'shared_rule', edits: shared });
  const user = segmentRuleEditsForLine(lineTokens, set.user, { language });
  if (user.length) layers.push({ marker: 'user_rule', edits: user });
  return layers;
}

// ── 화면 쓰기(② 사용자 규칙 — RLS 클라이언트, 본인 행만) ───────────────────────────
// FSRS · 평가 이력 · 단어장 · 출처 · 사전에는 쓰지 않는다(boundaryEditWiring.test.js 소스 계약).

/**
 * 화면: 내 규칙 목록(이 언어) — 표가 있는지도 같이 안다(읽기 1회, RLS로 본인 행만). 결과 {available, rules:[{surface, cuts}]}.
 * 표가 없거나 읽지 못하면 available:false — 화면은 ②③ 선택지와 카드 「규칙 지우기」를 숨긴다.
 */
export async function fetchUserSegmentRules(client, { language }) {
  if (!SEGMENT_RULE_LANGUAGES.includes(language)) return { available: false, rules: [] };
  try {
    const { data, error } = await client.from(SEGMENT_RULE_TABLES.user).select('surface, cuts')
      .eq('language', language).limit(SEGMENT_RULE_LIMITS.maxRows);
    if (error) return { available: false, rules: [] };
    return { available: true, rules: compileSegmentRules(data, language).map(({ surface, cuts }) => ({ surface, cuts })) };
  } catch {
    return { available: false, rules: [] };
  }
}

/** 토큰이 내 묶기 규칙(cuts [])으로 묶인 꼴인가 — 카드 「내 규칙으로 묶음 · [규칙 지우기]」. 표식 user_rule + 같은 꼴의 묶기 규칙. */
export function userRuleJoinOf(token, rules, language) {
  if (token?.boundary !== 'user_rule' || typeof token.text !== 'string') return null;
  const surface = normalizeSegmentSurface(language, token.text);
  return (rules || []).find(rule => rule.surface === surface && Array.isArray(rule.cuts) && rule.cuts.length === 0) ? surface : null;
}

export class SegmentRuleError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'SegmentRuleError';
    this.reason = reason;
  }
}

/** ② 규칙 저장(같은 꼴이면 칼선만 바꾼다). 결과 {rule}. 검증 실패 · 표 없음 · 쓰기 오류는 SegmentRuleError. */
export async function saveUserSegmentRule(client, { userId, language, surface, cuts = [], materialId = null }) {
  const checked = validateSegmentRule({ language, surface, cuts });
  if (!checked.ok) throw new SegmentRuleError(checked.reason);
  if (!userId) throw new SegmentRuleError('login');
  const { rule } = checked;
  const row = {
    user_id: userId, language, surface: rule.surface, cuts: rule.cuts,
    ...(Number.isSafeInteger(Number(materialId)) && Number(materialId) > 0 ? { source_material_id: Number(materialId) } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from(SEGMENT_RULE_TABLES.user).upsert(row, { onConflict: 'user_id,language,surface' });
  if (error) throw new SegmentRuleError(segmentRulesTableMissing(error) ? 'unavailable' : 'write');
  return { rule };
}

/**
 * ③ 공유 규칙 저장(관리자) — 관리자 라우트 /api/admin/segment-rules로만 쓴다(표에 쓰기 정책이 없다).
 * deps = {fetch, accessToken}. 실패는 SegmentRuleError('forbidden' | 'unavailable' | reason | 'write').
 */
export async function saveSharedSegmentRule({ language, surface, cuts = [] }, { fetch: fetchImpl, accessToken }) {
  const checked = validateSegmentRule({ language, surface, cuts });
  if (!checked.ok) throw new SegmentRuleError(checked.reason);
  let res;
  try {
    res = await fetchImpl('/api/admin/segment-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ language, surface: checked.rule.surface, cuts: checked.rule.cuts }),
    });
  } catch {
    throw new SegmentRuleError('write');
  }
  if (res.ok) return { rule: checked.rule };
  if (res.status === 401 || res.status === 403) throw new SegmentRuleError('forbidden');
  if (res.status === 503) throw new SegmentRuleError('unavailable');
  throw new SegmentRuleError('write');
}

/** ② 규칙 지우기(카드 「규칙 지우기」). 없는 규칙을 지워도 성공이다. */
export async function deleteUserSegmentRule(client, { userId, language, surface }) {
  if (!userId) throw new SegmentRuleError('login');
  if (!SEGMENT_RULE_LANGUAGES.includes(language)) throw new SegmentRuleError('language');
  const { error } = await client.from(SEGMENT_RULE_TABLES.user).delete()
    .eq('user_id', userId).eq('language', language).eq('surface', normalizeSegmentSurface(language, surface));
  if (error) throw new SegmentRuleError(segmentRulesTableMissing(error) ? 'unavailable' : 'write');
}

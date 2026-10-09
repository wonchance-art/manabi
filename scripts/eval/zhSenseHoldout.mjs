// 중국어 「이 문장 뜻」 측정 세트(ZH-SENSE-HOLDOUT-001) 채점 — 순수 함수(네트워크·DB 없음).
// 설계: docs/manabi-viewer-v2-ad-r4.md §3·§4 (AD-R4 PR① 측정 세트 · PR② 서버).
//
// - 자동 판정은 1차 선별이다. PASS/FAIL은 사례의 허용·금지 지정과 정확히 대조한 결과이고,
//   지정 밖은 REVIEW로 사람에게 넘긴다. 같은 모델의 자기 승인으로 REVIEW를 통과시키지 않는다.
// - N 팔의 프롬프트·응답 검증·뜻 정규화는 PR②에서 제품 모듈(src/lib/server/zhSenseReview.js — import 없는
//   순수 모듈)로 옮겼다. 이 파일은 그 정본을 import해 PR① 이름(…Draft·senseFragments·matchCandidate)으로
//   다시 내보낸다 — 중복 구현을 두지 않고, 측정이 제품과 같은 프롬프트·검증을 쓰게 한다.
import {
  ZH_SENSE_MAX_CANDIDATES, buildZhPosPrompt, matchZhSenseCandidate, validateZhSensePick, zhSenseFragments,
} from '../../src/lib/server/zhSenseReview.js';

export const SPLITS = Object.freeze(['tune', 'holdout']);
export const CATEGORIES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']);
export const ARMS = Object.freeze(['B0', 'B1', 'N']);

const MAX_CANDIDATES = ZH_SENSE_MAX_CANDIDATES; // 설계서 §4.1 — 사전 행 meanings 상한과 같다
const MAX_PAIRS = 20;
/** 운영 사전 스냅숏에서 온 후보의 candidatesSource 머리(뒤에 날짜). 임시 후보는 provisional:*. */
export const SNAPSHOT_SOURCE = 'morpheme_dictionary@';          // 설계서 §4.2 — 요청당 묶음 판정 상한
const HANGUL = /[가-힣]/;
const HAS_HANZI = /[一-鿿]/;

const clean = (value) => String(value ?? '').normalize('NFC').trim();
const len = (s) => [...s].length;

// ───────────────────────── 세트 무결성 ─────────────────────────

/** 금지 표현 대조(#1346 규칙): 한 글자는 조각 단위로만, 두 글자 이상은 부분 문자열로도 잡는다. */
function ctxHits(text, terms) {
  const pieces = senseFragments(text);
  const whole = clean(text);
  return terms.filter((term) => (len(term) === 1 ? pieces.includes(term) : whole.includes(term)));
}

/**
 * 세트 형식 검증. 문제 목록을 돌려준다(비면 통과).
 * 조정/보류 문장 겹침 0, id 유일, 범주 분포 = composition, 문장 안 표면형 위치, 허용·금지 겹침 0,
 * 비경계 사례는 금지 오답 1개 이상, E는 후보 밖 정답(ctx), 경계 사례는 pair·join.
 */
export function validateHoldout(set) {
  const problems = [];
  const cases = Array.isArray(set?.cases) ? set.cases : [];
  const ids = new Set();
  const sentenceSplit = new Map();
  const byId = new Map(cases.map((c) => [c.id, c]));
  const snapshotRows = new Map((set?.snapshot?.rows || []).map((r) => [r.base_form, r]));
  for (const c of cases) {
    const at = c?.id ?? '(id 없음)';
    if (ids.has(c.id)) problems.push(`${at}: id 중복`);
    ids.add(c.id);
    if (!SPLITS.includes(c.split)) problems.push(`${at}: split ${c.split} — tune|holdout만`);
    if (!set.categories?.[c.cat] || !CATEGORIES.includes(c.cat)) problems.push(`${at}: 범주 ${c.cat} 없음`);
    if (c.id?.[0] !== c.cat) problems.push(`${at}: id 머리글자와 범주가 다름`);
    const prev = sentenceSplit.get(c.sentence);
    if (prev && prev !== c.split) problems.push(`${at}: 조정·보류가 같은 문장을 공유함`);
    sentenceSplit.set(c.sentence, c.split);
    const t = c.target || {};
    if (!t.surface || typeof t.index !== 'number' || c.sentence?.slice(t.index, t.index + t.surface.length) !== t.surface) {
      problems.push(`${at}: 문장의 ${t.index} 위치에 표면형 ${t.surface} 없음`);
    }
    if (!t.base) problems.push(`${at}: 기본형 없음`);
    if (c.cat === 'D') {
      const b = c.boundary;
      if (!Array.isArray(b?.pair) || b.pair.length !== 2 || !b.pair.every((p) => typeof p === 'string' && p)) { problems.push(`${at}: boundary.pair 형식`); continue; }
      if (typeof b.join !== 'boolean') problems.push(`${at}: boundary.join은 true/false`);
      if (b.pair[0] !== t.surface) problems.push(`${at}: 대상 표면형은 pair의 앞 토큰이어야 함`);
      if (c.sentence?.slice(t.index, t.index + b.pair.join('').length) !== b.pair.join('')) problems.push(`${at}: 문장에 pair가 이어져 있지 않음`);
      if (!clean(b.why)) problems.push(`${at}: boundary.why(기대 경계의 이유) 없음`);
      continue;
    }
    const n = Array.isArray(c.candidates) ? c.candidates.length : 0;
    if (n < 1 || n > MAX_CANDIDATES) problems.push(`${at}: 후보 수 ${n} — 1~${MAX_CANDIDATES}`);
    if ((c.candidates || []).some((m) => !clean(m?.meaning) || !clean(m?.pos))) problems.push(`${at}: 후보에 meaning·pos 필요`);
    if (!clean(c.pos)) problems.push(`${at}: 기대 품사 없음`);
    if (!clean(c.candidatesSource)) problems.push(`${at}: candidatesSource 없음`);
    const acceptSense = c.accept?.sense ?? [];
    const acceptCtx = c.accept?.ctx ?? [];
    const forbidSense = (c.forbidden || []).filter((f) => f.sense != null).map((f) => f.sense);
    const forbidCtx = (c.forbidden || []).filter((f) => f.ctx != null).map((f) => f.ctx);
    if (!(c.forbidden || []).length) problems.push(`${at}: 금지 오답 없음`);
    if ((c.forbidden || []).some((f) => !clean(f.why))) problems.push(`${at}: 금지 오답에 이유 없음`);
    if (c.cat === 'E') {
      if (!acceptCtx.length || acceptSense.length) problems.push(`${at}: E는 후보 밖 정답(accept.ctx)만`);
    } else if (!acceptSense.length && !acceptCtx.length) problems.push(`${at}: accept 비어 있음(sense 또는 ctx)`);
    // 운영 행 후보는 스냅숏 행의 앞 3개와 순서·문구·품사가 같아야 한다(손으로 고친 후보가 「운영 행」으로 둔갑하지 않게).
    if (String(c.candidatesSource || '').startsWith(SNAPSHOT_SOURCE)) {
      const row = snapshotRows.get(t.base);
      const want = row ? row.meanings.slice(0, MAX_CANDIDATES).map((m) => ({ meaning: m.meaning, pos: m.pos })) : null;
      const got = (c.candidates || []).map((m) => ({ meaning: m.meaning, pos: m.pos }));
      if (!row) problems.push(`${at}: 스냅숏에 ${t.base} 행 없음`);
      else if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${at}: 후보가 스냅숏 ${t.base} 행과 다름`);
    }
    for (const s of [...acceptSense, ...forbidSense]) if (!Number.isInteger(s) || s < 1 || s > n) problems.push(`${at}: 후보 번호 ${s} 범위 밖`);
    const overlap = acceptSense.filter((s) => forbidSense.includes(s));
    if (overlap.length) problems.push(`${at}: 허용과 금지가 겹침 ${overlap.join(',')}`);
    if (acceptCtx.some((a) => len(clean(a)) < 2 || !HANGUL.test(a))) problems.push(`${at}: accept.ctx는 한글 2자 이상`);
    const ctxOverlap = acceptCtx.filter((a) => ctxHits(a, forbidCtx).length);
    if (ctxOverlap.length) problems.push(`${at}: 허용 표현과 금지 표현이 겹침 ${ctxOverlap.join(',')}`);
    if (c.cat === 'F') {
      const twin = byId.get(c.twinOf);
      if (!twin) problems.push(`${at}: twinOf ${c.twinOf} 없음`);
      else {
        if (twin.split !== c.split) problems.push(`${at}: 번체 쌍둥이는 쌍과 같은 세트여야 함`);
        if (JSON.stringify(twin.accept) !== JSON.stringify(c.accept)) problems.push(`${at}: 쌍과 기대 답이 다름`);
      }
    }
  }
  for (const cat of CATEGORIES) {
    for (const split of SPLITS) {
      const want = set.composition?.[cat]?.[split];
      const got = cases.filter((c) => c.cat === cat && c.split === split).length;
      if (want !== got) problems.push(`구성: ${cat}/${split} ${got}건 ≠ ${want}`);
    }
  }
  return problems;
}

/**
 * 운영 사전에 아직 행이 없어 임시 후보로 남은 표제어(생성 대기) — 뜻 사례의 기본형, 중복 없이 정렬.
 * 측정 전에 scripts/eval/generate-zh-sense-candidates.mjs가 운영 생성 경로(fetchMeaningsForMissing)로 얼린다.
 */
export function pendingCandidateForms(set) {
  const forms = (set?.cases || [])
    .filter((c) => c.cat !== 'D' && String(c.candidatesSource || '').startsWith('provisional'))
    .map((c) => c.target.base);
  return [...new Set(forms)].sort();
}

// ───────────────────────── 뜻 정규화 ─────────────────────────

/** 뜻 문구 → 비교 조각(정본: zhSenseReview.js zhSenseFragments). */
export const senseFragments = zhSenseFragments;

/** ctx 문구가 후보 하나와 같은 뜻 조각이면 그 후보 번호(1부터), 아니면 0(정본: matchZhSenseCandidate). */
export const matchCandidate = matchZhSenseCandidate;

// ───────────────────────── 채점 ─────────────────────────

/**
 * 한 사례 채점.
 * @param {object} c 세트 사례
 * @param {object} outcome
 *   뜻 사례: { meaning, via?: 'sense'|'ctx'|'fallback', meaningCheck? } — meaning이 후보 문구와 같으면 그 번호로 본다
 *   경계 사례: { merged: boolean, suggested?: boolean, autoMerged?: boolean }
 *   공통: { error } → ERROR, { blocked } → BLOCKED(대상 토큰이 다른 경계로 잘려 뜻 선택 대상이 아님 등)
 * @returns {{verdict, reason, sense?: number, wrongAutoMerge?: boolean}}
 */
export function scoreCase(c, outcome) {
  if (outcome?.error) return { verdict: 'ERROR', reason: String(outcome.error) };
  if (outcome?.blocked) return { verdict: 'BLOCKED', reason: String(outcome.blocked) };
  if (c.cat === 'D') {
    if (typeof outcome?.merged !== 'boolean') return { verdict: 'ERROR', reason: '경계 결과 없음' };
    const { join } = c.boundary;
    const wrongAutoMerge = !!outcome.autoMerged && !join;
    if (outcome.merged === join) return { verdict: 'PASS', reason: join ? '한 단어로 묶임' : '나뉜 채 유지', wrongAutoMerge };
    if (join && outcome.suggested) return { verdict: 'REVIEW', reason: '미등재 — 「묶을까요?」 후보로만 제시', wrongAutoMerge };
    return { verdict: 'FAIL', reason: join ? `한 단어인데 나뉨: ${c.boundary.why}` : `오병합: ${c.boundary.why}`, wrongAutoMerge };
  }
  const meaning = clean(outcome?.meaning);
  if (!meaning) return { verdict: 'BLOCKED', reason: '뜻 없음' };
  const idx = (c.candidates || []).findIndex((m) => clean(m.meaning) === meaning) + 1;
  const forbidSense = (c.forbidden || []).filter((f) => f.sense != null);
  const forbidCtx = (c.forbidden || []).filter((f) => f.ctx != null);
  if (idx > 0) {
    const bad = forbidSense.find((f) => f.sense === idx);
    if (bad) return { verdict: 'FAIL', reason: `후보 ${idx} ${meaning}: ${bad.why}`, sense: idx };
    if ((c.accept?.sense || []).includes(idx)) return { verdict: 'PASS', reason: `후보 ${idx} ${meaning}`, sense: idx };
    return { verdict: 'REVIEW', reason: `후보 ${idx} ${meaning} — 허용·금지 지정 밖, 사람 판정`, sense: idx };
  }
  const bad = forbidCtx.filter((f) => ctxHits(meaning, [f.ctx]).length);
  if (bad.length) return { verdict: 'FAIL', reason: `문맥 뜻 ${meaning}: ${bad.map((f) => f.why).join(' / ')}`, sense: 0 };
  const ok = (c.accept?.ctx || []).filter((a) => meaning.includes(a));
  if (ok.length) return { verdict: 'PASS', reason: `문맥 뜻 ${meaning} (허용 ${ok[0]})`, sense: 0 };
  return { verdict: 'REVIEW', reason: `후보 밖 문맥 뜻 ${meaning} — 사람 판정`, sense: 0 };
}

/**
 * B0 — 현행에 정답 품사를 준다고 가정한 오프라인 기준선: pickZhMeaning(candidates, 기대 품사).
 * 제품 함수를 인자로 받아 이 파일을 순수하게 둔다. 경계 사례는 현행 토크나이저 결과(currentMerged)로 본다.
 */
export function baselineB0(c, pickZhMeaning, currentMerged) {
  if (c.cat === 'D') return typeof currentMerged === 'boolean' ? { merged: currentMerged } : { error: '현행 경계 미계산' };
  return { meaning: pickZhMeaning(c.candidates, c.pos), via: 'fallback' };
}

// ───────────────────────── 집계 · 켜는 기준 ─────────────────────────

/** 팔(arm)·세트별 집계. rows: [{id, cat, split, arm, verdict, wrongAutoMerge?}] */
export function summarize(set, rows) {
  const critical = new Set(set.criticalCategories || []);
  const out = {};
  for (const arm of ARMS) {
    for (const split of SPLITS) {
      const mine = rows.filter((r) => r.arm === arm && r.split === split);
      if (!mine.length) continue;
      const count = Object.fromEntries(VERDICTS.map((v) => [v, mine.filter((r) => r.verdict === v).length]));
      const byCat = Object.fromEntries(CATEGORIES.map((cat) => [cat, Object.fromEntries(VERDICTS.map((v) => [v, mine.filter((r) => r.cat === cat && r.verdict === v).length]))]));
      out[`${arm}/${split}`] = {
        arm, split, total: mine.length, ...count, byCat,
        criticalFail: mine.filter((r) => r.verdict === 'FAIL' && critical.has(r.cat)).map((r) => r.id),
        wrongAutoMerge: mine.filter((r) => r.wrongAutoMerge).map((r) => r.id),
      };
    }
  }
  return out;
}

const p95 = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] : null;
};

/**
 * 켜는 기준(설계서 §3.5) — 보류 세트의 B1 대 N.
 * @param {object} set
 * @param {Array} rows 채점 행(arm B1·N 포함)
 * @param {{b1: {calls:number[], ms:number[]}, n: {calls:number[], ms:number[]}}} [stats] 요청(문단)별 호출 수·지연
 * @returns {{status: '켜기 기준 충족'|'보류'|'사람 판정 대기', reasons: string[], detail: object}}
 */
export function evaluateRelease(set, rows, stats) {
  const criteria = set.releaseCriteria || {};
  const split = criteria.split || 'holdout';
  const critical = new Set(set.criticalCategories || []);
  const pick = (arm) => rows.filter((r) => r.arm === arm && r.split === split);
  const b1 = pick('B1');
  const n = pick('N');
  const reasons = [];
  if (!b1.length || !n.length) return { status: '보류', reasons: [`${split} 세트의 B1·N 결과가 모두 있어야 판정한다`], detail: {} };
  const fails = (xs) => xs.filter((r) => r.verdict === 'FAIL');
  const critFail = (xs) => fails(xs).filter((r) => critical.has(r.cat)).length;
  const errors = [...b1, ...n].filter((r) => r.verdict === 'ERROR').length;
  const review = n.filter((r) => r.verdict === 'REVIEW').length;
  const wrongAutoMerge = n.filter((r) => r.wrongAutoMerge).map((r) => r.id);
  const b1Pass = new Set(b1.filter((r) => r.verdict === 'PASS').map((r) => r.id));
  const passToFail = n.filter((r) => r.verdict === 'FAIL' && b1Pass.has(r.id)).map((r) => r.id);
  const failB1 = fails(b1).length;
  const failN = fails(n).length;
  const reduction = failB1 ? (failB1 - failN) / failB1 : 0;
  // 운영 행이 아닌 임시 후보로 잰 사례가 남아 있으면 결과가 운영을 대표하지 않는다 — 생성 후보로 얼린 뒤 다시 잰다.
  const provisional = (set.cases || []).filter((c) => c.split === split && c.cat !== 'D' && String(c.candidatesSource || '').startsWith('provisional')).map((c) => c.id);
  if (provisional.length) reasons.push(`임시 후보 ${provisional.length}건(${provisional.join(', ')}) — 운영 생성 경로로 얼린 후보로 바꾸기 전에는 판정하지 않는다`);
  if (errors) reasons.push(`호출 오류 ${errors}건 — 재실행 필요`);
  if (criteria.criticalFailBelowB1 !== false && !(critFail(n) < critFail(b1))) reasons.push(`치명 범주 FAIL이 줄지 않음(B1 ${critFail(b1)} → N ${critFail(n)})`);
  if (wrongAutoMerge.length > (criteria.wrongAutoMergeMax ?? 0)) reasons.push(`오병합 자동 적용 ${wrongAutoMerge.length}건: ${wrongAutoMerge.join(', ')}`);
  if (!failB1) reasons.push('B1 FAIL 0건 — 줄일 오답이 없어 켤 근거가 없다');
  else if (reduction < (criteria.totalFailReductionMin ?? 0.3)) reasons.push(`전체 FAIL 감소 ${(reduction * 100).toFixed(0)}% < ${((criteria.totalFailReductionMin ?? 0.3) * 100).toFixed(0)}%(B1 ${failB1} → N ${failN})`);
  if (passToFail.length > (criteria.passToFailMax ?? 1)) reasons.push(`B1 PASS → N FAIL ${passToFail.length}건: ${passToFail.join(', ')}`);
  const detail = { split, failB1, failN, reduction, criticalB1: critFail(b1), criticalN: critFail(n), passToFail, wrongAutoMerge, reviewN: review };
  if (stats) {
    const callsDiffer = stats.b1.calls.length !== stats.n.calls.length || stats.b1.calls.some((x, i) => x !== stats.n.calls[i]);
    if (criteria.callsPerRequestEqual !== false && callsDiffer) reasons.push(`요청당 호출 수가 다름(B1 ${stats.b1.calls.join(',')} / N ${stats.n.calls.join(',')})`);
    const d = (p95(stats.n.ms) ?? 0) - (p95(stats.b1.ms) ?? 0);
    detail.p95DeltaMs = d;
    if (d > (criteria.p95LatencyIncreaseMaxMs ?? 1000)) reasons.push(`판별 호출 p95 지연 +${d}ms > ${criteria.p95LatencyIncreaseMaxMs ?? 1000}ms`);
  } else reasons.push('호출 수·지연 통계 없음');
  const status = reasons.length ? '보류' : review ? '사람 판정 대기' : '켜기 기준 충족';
  return { status, reasons, detail };
}

// ───────────────────────── 실행 묶음(문단) ─────────────────────────

/**
 * 사례를 실제 요청처럼 문단으로 묶는다(설계서 §3.5 — 문장 4~8개). 세트별로 범주를 번갈아 섞어
 * 한 문단이 한 범주로 쏠리지 않게 하고, 순서는 결정적이다.
 */
export function buildParagraphs(cases, size = 6) {
  const out = [];
  for (const split of SPLITS) {
    const queues = CATEGORIES.map((cat) => cases.filter((c) => c.split === split && c.cat === cat));
    const mixed = [];
    while (queues.some((q) => q.length)) for (const q of queues) if (q.length) mixed.push(q.shift());
    for (let i = 0; i < mixed.length; i += size) out.push({ split, cases: mixed.slice(i, i + size) });
  }
  return out;
}

/**
 * 이웃 두 한자 토큰을 이은 꼴이 등재(isRegistered)인 쌍 — PR① 시안의 [묶음 판정] 후보(설계서 §5.2, 요청당 ≤20).
 * PR④부터 실행기 N 팔은 제품 collectZhBoundaryPairs(src/lib/server/zhBoundaryReview.js — 사전 행·기록 구간·OOV 제외까지)를 쓴다.
 * 이 시안은 PR① 단위 계약(zhSenseHoldout.test.js)을 위해 남긴다.
 */
export function collectPairCandidates(tokenizedLines, isRegistered, limit = MAX_PAIRS) {
  const pairs = [];
  tokenizedLines.forEach(({ tokens }, lineIdx) => {
    let offset = 0;
    const spans = (tokens || []).map((t) => { const s = { t, start: offset }; offset += String(t.text || '').length; return s; });
    for (let i = 0; i + 1 < spans.length; i++) {
      const a = spans[i].t.text;
      const b = spans[i + 1].t.text;
      if (!HAS_HANZI.test(a || '') || !HAS_HANZI.test(b || '')) continue;
      if (isRegistered(a + b)) pairs.push({ lineIdx, a, b, start: spans[i].start });
    }
  });
  return pairs.slice(0, limit);
}

// ───────────────────────── N 프롬프트 · 응답 검증(제품 정본 재수출) ─────────────────────────

/**
 * N 프롬프트 — 제품 buildZhPosPrompt(src/lib/server/zhSenseReview.js) 그 자체. 마크에 candidates·pair가 하나도
 * 없으면 AD-R4 이전 현행 프롬프트와 바이트 단위로 같다 — zhSenseHoldout.test.js와 실행기 --dry-run이
 * 실제 판별기(disambiguateZhPos)가 보낸 본문과 대조해 회귀를 막는다.
 */
export const buildZhSensePromptDraft = buildZhPosPrompt;

/** N 응답 항목 하나 검증(설계서 §4.3 표) — 제품 validateZhSensePick 그 자체. */
export const validateSensePickDraft = validateZhSensePick;

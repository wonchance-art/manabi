// 중국어 「이 문장 뜻」 측정 세트(ZH-SENSE-HOLDOUT-001) 채점 — 순수 함수(네트워크·DB·제품 모듈 import 없음).
// 설계: docs/manabi-viewer-v2-ad-r4.md §3·§4 (AD-R4 PR①). 제품 코드에는 아무것도 더하지 않는다.
//
// - 자동 판정은 1차 선별이다. PASS/FAIL은 사례의 허용·금지 지정과 정확히 대조한 결과이고,
//   지정 밖은 REVIEW로 사람에게 넘긴다. 같은 모델의 자기 승인으로 REVIEW를 통과시키지 않는다.
// - N(후보 고르기 합친 시안) 프롬프트와 응답 검증은 **이 파일에만** 있는 eval 전용 시안이다.
//   제품 반영은 PR②에서 따로 한다(설계서 §10).

export const SPLITS = Object.freeze(['tune', 'holdout']);
export const CATEGORIES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']);
export const ARMS = Object.freeze(['B0', 'B1', 'N']);

const MAX_CANDIDATES = 3;      // 설계서 §4.1 — 사전 행 meanings 상한과 같다
const CTX_MAX_CHARS = 10;      // 설계서 §4.3
const MAX_PAIRS = 20;          // 설계서 §4.2 — 요청당 묶음 판정 상한
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
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
    } else if (!acceptSense.length) problems.push(`${at}: accept.sense 비어 있음`);
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

// ───────────────────────── 뜻 정규화 ─────────────────────────

/**
 * 뜻 문구 → 비교 조각. 괄호 보충을 빼고 쉼표·세미콜론·슬래시로 나눈다.
 * (AE-R1 buildSenseList 규칙과 같은 방향. 그 함수가 병합되면 PR②에서 그것을 import한다.)
 */
export function senseFragments(text) {
  return clean(text)
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .split(/[,，;；/／、]/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** ctx 문구가 후보 하나와 같은 뜻 조각이면 그 후보 번호(1부터), 아니면 0. */
export function matchCandidate(candidates, text) {
  const frags = senseFragments(text);
  if (!frags.length) return 0;
  const i = (candidates || []).findIndex((m) => {
    const mine = senseFragments(m?.meaning);
    return frags.every((f) => mine.includes(f));
  });
  return i + 1;
}

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

/** 이웃 두 한자 토큰을 이은 꼴이 등재(isRegistered)인 쌍 — N의 [묶음 판정] 후보(설계서 §5.2, 요청당 ≤20). */
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

// ───────────────────────── N 시안 프롬프트(eval 전용) ─────────────────────────

/**
 * N 시안 프롬프트 — 현행 buildZhPosPrompt(src/lib/server/disambiguateZhPos.js)에 설계서 §4.2의
 * 추가분(뜻 후보·sense·ctx·묶음 판정)만 더한다. 마크에 candidates·pair가 하나도 없으면 현행 프롬프트와
 * 바이트 단위로 같아야 한다 — zhSenseHoldout.test.js와 실행기 --dry-run이 실제 현행 함수 출력과 대조한다.
 * @param {string[]} lines
 * @param {Array<{lineIdx, word, oov?, candidates?: Array<{meaning,pos}>, pair?: [string,string]}>} marks
 */
export function buildZhSensePromptDraft(lines, marks) {
  const usedLineIdxs = [...new Set(marks.map((m) => m.lineIdx))];
  const lineNo = new Map(usedLineIdxs.map((idx, i) => [idx, i + 1]));
  const sentenceList = usedLineIdxs.map((idx) => `${lineNo.get(idx)}. ${lines[idx]}`).join('\n');
  const hasSense = marks.some((m) => m.candidates?.length);
  const hasJoin = marks.some((m) => m.pair);
  const wordList = marks
    .map((m, i) => {
      let line = `${i + 1}. "${m.word}" (문장 ${lineNo.get(m.lineIdx)})${m.oov ? ' [단어성 판정]' : ''}`;
      if (m.pair) line += ` [묶음 판정: ${m.pair[0]}+${m.pair[1]}]`;
      if (m.candidates?.length) line += ` 뜻 후보: ${m.candidates.map((c, k) => `${CIRCLED[k]}${c.meaning}(${c.pos})`).join(' ')}`;
      return line;
    })
    .join('\n');
  const extraExamples = [
    ...(hasSense ? ['  { "all": ["동사"], "pos": "동사", "sense": 2 },', '  { "all": ["동사"], "pos": "동사", "sense": 0, "ctx": "질투하다" },'] : []),
    ...(hasJoin ? ['  { "all": ["양사"], "pos": "양사", "join": false },'] : []),
  ];
  const extraRules = [
    ...(hasSense ? [
      '- sense: 「뜻 후보」가 있는 단어만. 이 문장에서 맞는 후보의 번호(1부터). 맞는 후보가 없으면 0',
      '- ctx: sense가 0일 때만. 이 문장에서의 한국어 뜻, 10자 이내',
      '- 후보 문구를 고쳐 쓰지 말고 번호로만 답할 것. 뜻 후보가 없는 단어에는 sense를 넣지 말 것',
    ] : []),
    ...(hasJoin ? ['- join: [묶음 판정] 표시 항목만. 표시된 두 토큰이 이 문장에서 한 단어로 쓰였으면 true, 아니면 false'] : []),
  ];
  return `다음은 중국어 문장 목록과, 각 문장에서 품사를 판정할 단어 목록입니다.

## 문장
${sentenceList}

## 단어
${wordList}

각 단어에 대해 JSON 배열로 답하세요.

## 출력 형식 (단어 목록과 순서·길이 정확히 일치)
[
  { "all": ["동사", "명사"], "pos": "동사" },
  { "all": ["명사"], "pos": "명사" },
  { "all": [], "pos": null, "split": [{"t": "笔", "pos": "명사"}, {"t": "在", "pos": "전치사"}] },
${extraExamples.length ? `${extraExamples.join('\n')}\n` : ''}  ...
]

## 규칙
- all: 이 단어가 중국어에서 일반적으로 갖는 품사 후보 (흔한 순, 1~3개)
- pos: 지정된 문장의 맥락에서 이 단어가 실제로 쓰인 품사 — 반드시 all 중 하나
- split: [단어성 판정] 표시 항목만 — 이 표기가 실제 쓰이는 한 단어(신조어·전문어·고유명사
  포함)면 split을 넣지 말 것. 별개 단어들이 우연히 이웃해 붙은 조합일 때만 순서대로
  분해해 각 부분의 표기(t)와 그 문장에서의 품사(pos)를 적을 것 (부분들을 이으면 원 표기와
  정확히 일치해야 함)
${extraRules.length ? `${extraRules.join('\n')}\n` : ''}- 품사 명칭: 명사/동사/형용사/부사/전치사/접속사/조사/대명사/양사/수사/감탄사/성어/지명/인명/고유명사
- 설명/주석 금지, JSON만 출력`;
}

/**
 * N 응답 항목 하나 검증(설계서 §4.3 표) — eval 전용 시안.
 * @param {object} entry 모델 응답 배열의 i번째
 * @param {{word, candidates?, pair?}} mark
 * @param {(pos:string)=>boolean} [isCanon] 품사 정본 필터(현행과 같게 all을 거른다)
 * @returns {{discarded?: 'pos', pos?, all?, sense?: {meaning, via:'sense'|'ctx', meaningCheck?}, senseDiscarded?: string, meaningCheck?: 'doubt', join?: boolean}}
 */
export function validateSensePickDraft(entry, mark, isCanon = () => true) {
  const all = Array.isArray(entry?.all)
    ? entry.all.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim().slice(0, 20)).filter(isCanon).slice(0, 4)
    : [];
  const pos = typeof entry?.pos === 'string' ? entry.pos.trim().slice(0, 20) : '';
  const out = {};
  if (mark.pair && typeof entry?.join === 'boolean') out.join = entry.join;
  if (!pos || !all.includes(pos)) return { ...out, discarded: 'pos' }; // 지금 규칙 — 그 단어는 폴백
  out.pos = pos;
  out.all = all;
  const cands = mark.candidates || [];
  if (!cands.length || !('sense' in (entry || {}))) return out; // 후보 없는 단어의 sense는 무시
  const { sense } = entry;
  if (Number.isInteger(sense) && sense >= 1 && sense <= cands.length) {
    const c = cands[sense - 1];
    out.sense = { meaning: c.meaning, via: 'sense', ...(c.pos && c.pos !== pos ? { meaningCheck: 'doubt' } : {}) };
    return out;
  }
  if (sense === 0) {
    const ctx = typeof entry.ctx === 'string' ? clean(entry.ctx) : '';
    if (ctx && len(ctx) <= CTX_MAX_CHARS && HANGUL.test(ctx) && !HAS_HANZI.test(ctx)) {
      const same = matchCandidate(cands, ctx);
      out.sense = same ? { meaning: cands[same - 1].meaning, via: 'sense' } : { meaning: ctx, via: 'ctx', meaningCheck: 'ctx' };
      return out;
    }
    return { ...out, senseDiscarded: 'ctx 없음·초과·비한글', meaningCheck: 'doubt' };
  }
  return { ...out, senseDiscarded: `범위 밖·비정수 sense(${JSON.stringify(sense)})` };
}

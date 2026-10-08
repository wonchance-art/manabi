// 서버 전용 — 중국어 「이 문장 뜻」 검수(AD-R4, 설계서 docs/manabi-viewer-v2-ad-r4.md §4).
// 품사 판별 호출(disambiguateZhPos — 요청당 light 1회)에 「뜻 후보 ①②③」을 실어 같은 호출로 뜻 번호를 받는다.
// 호출 수는 늘지 않는다. 모델은 후보 **번호**로만 답하고, 후보 밖 답·형식 위반은 그 단어만 버려
// 현행(pickZhMeaning)으로 돌아간다 — 지금의 `pos ∉ all이면 버림`을 뜻에 넓힌 규칙이다.
//
// 켜고 끄는 것은 disambiguateZhPos.js의 ZH_SENSE_REVIEW 상수(기본 false)다. 꺼져 있으면 라우트가 후보를
// 붙이지 않으므로 이 모듈의 프롬프트·검증은 현행과 바이트 단위로 같다(zhSenseReviewRoute.test.js 스냅숏).
//
// 이 모듈은 import가 없는 순수 함수만 둔다 — 측정 실행기(scripts/eval/run-zh-sense-holdout.mjs)와
// 채점기(scripts/eval/zhSenseHoldout.mjs)가 번들러 없이 그대로 import해 제품과 같은 프롬프트·검증으로 잰다.

export const ZH_SENSE_MAX_CANDIDATES = 3; // 사전 행 meanings 상한과 같다(fetchMeanings slice(0, 3))
export const ZH_SENSE_CTX_MAX_CHARS = 10;
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
const HANGUL = /[가-힣]/;
const HAS_HANZI = /[一-鿿]/;

const clean = (value) => String(value ?? '').normalize('NFC').trim();
const len = (s) => [...s].length;

// ───────────────────────── 뜻 정규화 ─────────────────────────

/**
 * 뜻 문구 → 비교 조각. 괄호 보충을 빼고 쉼표·세미콜론·슬래시로 나눈다.
 * (AE-R1 buildSenseList와 같은 방향의 규칙. 그 함수가 병합되면 이 정규화를 그쪽으로 합친다.)
 */
export function zhSenseFragments(text) {
  return clean(text)
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .split(/[,，;；/／、]/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** ctx 문구가 후보 하나와 같은 뜻 조각이면 그 후보 번호(1부터), 아니면 0. */
export function matchZhSenseCandidate(candidates, text) {
  const frags = zhSenseFragments(text);
  if (!frags.length) return 0;
  const i = (candidates || []).findIndex((m) => {
    const mine = zhSenseFragments(m?.meaning);
    return frags.every((f) => mine.includes(f));
  });
  return i + 1;
}

// ───────────────────────── 후보 붙이기(§4.1) ─────────────────────────

/**
 * 판별 마크에 「뜻 후보」를 붙인 새 배열(입력은 바꾸지 않는다 · 키·순서·길이 그대로 — 응답 길이 계약).
 * 붙이는 조건(모두): 사전 행이 있고 뜻이 minMeanings(기본 2)개 이상 · source가 user_verified가 아님
 * (오너 확정 첫 뜻을 그대로 쓴다) · 이번 요청의 미싱·재조회 목록에 없음(뜻이 바뀌는 중) · 그 줄의 같은
 * 표기 토큰에 이합사 조각(sep_link)·기본형 불일치·AD-R3 경계 표식(boundary)이 없음.
 * 후보는 행의 meanings 순서대로 최대 3개, 프롬프트에 필요한 meaning·pos만 싣는다.
 * @param {Array<{lineIdx, word, key}>} marks collectZhPosMarks 결과
 * @param {{tokenizedLines: Array<{tokens}>, cache: Map, refreshForms?: Set<string>, minMeanings?: number}} ctx
 */
export function attachZhSenseCandidates(marks, { tokenizedLines, cache, refreshForms = new Set(), minMeanings = 2 }) {
  return marks.map((mark) => {
    const row = cache.get(mark.word); // 중국어는 base_form === 표면형
    const meanings = Array.isArray(row?.meanings) ? row.meanings.filter((m) => m?.meaning) : [];
    if (!row || row.source === 'user_verified' || meanings.length < minMeanings) return { ...mark };
    if (refreshForms.has(mark.word)) return { ...mark };
    const sameText = (tokenizedLines[mark.lineIdx]?.tokens || []).filter((t) => t?.text === mark.word);
    if (sameText.some((t) => t.sep_link || t.base_form !== t.text || t.boundary)) return { ...mark };
    const candidates = meanings.slice(0, ZH_SENSE_MAX_CANDIDATES)
      .map((m) => ({ meaning: m.meaning, ...(m.pos ? { pos: m.pos } : {}) }));
    return { ...mark, candidates };
  });
}

// ───────────────────────── 프롬프트(§4.2) ─────────────────────────

/**
 * 품사 판별 프롬프트 — 현행(AD-R4 이전 disambiguateZhPos.js buildZhPosPrompt)에 뜻 후보·sense·ctx·묶음 판정을 더한다.
 * 마크에 candidates·pair가 하나도 없으면 현행과 바이트 단위로 같다.
 * @param {string[]} lines 요청의 원 줄 배열
 * @param {Array<{lineIdx, word, oov?, candidates?: Array<{meaning, pos?}>, pair?: [string, string]}>} marks
 */
export function buildZhPosPrompt(lines, marks) {
  // 판별 단어가 있는 줄만 실어 프롬프트를 줄인다(원 줄 번호 → 표시 번호 재부여).
  const usedLineIdxs = [...new Set(marks.map((m) => m.lineIdx))];
  const lineNo = new Map(usedLineIdxs.map((idx, i) => [idx, i + 1]));
  const sentenceList = usedLineIdxs.map((idx) => `${lineNo.get(idx)}. ${lines[idx]}`).join('\n');
  const hasSense = marks.some((m) => m.candidates?.length);
  const hasJoin = marks.some((m) => m.pair);
  const wordList = marks
    .map((m, i) => {
      let line = `${i + 1}. "${m.word}" (문장 ${lineNo.get(m.lineIdx)})${m.oov ? ' [단어성 판정]' : ''}`;
      if (m.pair) line += ` [묶음 판정: ${m.pair[0]}+${m.pair[1]}]`;
      if (m.candidates?.length) {
        line += ` 뜻 후보: ${m.candidates.map((c, k) => `${CIRCLED[k]}${c.meaning}${c.pos ? `(${c.pos})` : ''}`).join(' ')}`;
      }
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

// ───────────────────────── 응답 검증(§4.3) ─────────────────────────

/**
 * 응답 항목의 all·pos 정규화 — 현행 판별기 규칙 그대로(정본 필터 · 20자 · 후보 4개).
 * @param {(pos: string) => boolean} isCanon
 */
export function parseZhPosEntry(entry, isCanon) {
  const all = Array.isArray(entry?.all)
    // X 게이트: 후보를 정본으로 걸러야 「동사·喝咖啡」가 pos_all·사전에 안 실린다. 걸러서 비면 기존 폴백.
    ? entry.all.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim().slice(0, 20)).filter((p) => isCanon(p)).slice(0, 4)
    : [];
  const pos = typeof entry?.pos === 'string' ? entry.pos.trim().slice(0, 20) : '';
  return { all, pos };
}

/**
 * 뜻 후보·묶음 판정이 실린 마크의 응답 항목 하나 검증(설계서 §4.3 표).
 * - pos ∉ all → 그 단어 전부 버림(지금 규칙) · 후보 없는 단어의 sense → 무시
 * - sense 정수 1..n → 후보 문구 그대로. 후보 pos ≠ 판정 pos면 meaningCheck 'doubt'
 * - sense 범위 밖·비정수·문자열 → 버림(senseDiscarded) → 그 단어는 pickZhMeaning
 * - sense 0 + ctx 1~10자 한글(한자 없음) → 후보와 정규화가 같으면 그 후보, 아니면 문맥 뜻(meaningCheck 'ctx')
 * - sense 0 + ctx 없음·초과·비한글 → 버림 + meaningCheck 'doubt'
 * - join → 묶음 판정 마크의 불리언만 받는다
 * @param {object} entry 모델 응답 배열의 i번째
 * @param {{word, candidates?, pair?}} mark
 * @param {(pos: string) => boolean} [isCanon] 품사 정본 필터(현행과 같게 all을 거른다)
 * @returns {{discarded?: 'pos', pos?, all?, sense?: {meaning, via: 'sense'|'ctx', meaningCheck?}, senseDiscarded?: string, meaningCheck?: 'doubt', join?: boolean}}
 */
export function validateZhSensePick(entry, mark, isCanon = () => true) {
  const { all, pos } = parseZhPosEntry(entry, isCanon);
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
    if (ctx && len(ctx) <= ZH_SENSE_CTX_MAX_CHARS && HANGUL.test(ctx) && !HAS_HANZI.test(ctx)) {
      const same = matchZhSenseCandidate(cands, ctx);
      out.sense = same ? { meaning: cands[same - 1].meaning, via: 'sense' } : { meaning: ctx, via: 'ctx', meaningCheck: 'ctx' };
      return out;
    }
    return { ...out, senseDiscarded: 'ctx 없음·초과·비한글', meaningCheck: 'doubt' };
  }
  return { ...out, senseDiscarded: `범위 밖·비정수 sense(${JSON.stringify(sense)})` };
}

/**
 * 검증 결과 → disambiguateZhPos pick. 현행 pick 모양({pos, all})에 sense·meaningCheck·join만 더한다.
 * 묶음 판정만을 위해 더한 마크(pairOnly)는 품사 결과를 쓰지 않는다(§4.2) — pos null·all []은
 * resolveZhTokenPos·buildZhPosWriteback에서 pick이 없는 것과 같게 처리된다.
 * @returns {object|null} null이면 pick 없음(그 단어는 현행 폴백)
 */
export function zhSensePickFrom(v, mark) {
  const join = typeof v.join === 'boolean' ? { join: v.join } : {};
  if (mark.pairOnly || v.discarded) return 'join' in join ? { pos: null, all: [], ...join } : null;
  return {
    pos: v.pos,
    all: v.all,
    ...(v.sense ? { sense: v.sense } : {}),
    ...(!v.sense && v.meaningCheck ? { meaningCheck: v.meaningCheck } : {}),
    ...join,
  };
}

// ───────────────────────── stats(§4.4) ─────────────────────────

/** 응답 stats.zhSense 초기값 — 측정·운영 관찰용(학습 이벤트 아님). join* 은 경계 PR④가 채운다. */
export function createZhSenseStats(marks) {
  return {
    offered: marks.filter((m) => m.candidates?.length).length,
    picked: 0, ctx: 0, doubt: 0, discarded: 0,
    joinAsked: marks.filter((m) => m.pair).length, joinApplied: 0, joinSuggested: 0,
  };
}

/** 후보가 실린 마크 하나의 검증 결과를 stats에 센다. */
export function tallyZhSense(stats, mark, v) {
  if (!mark.candidates?.length || mark.pairOnly) return;
  if (v.discarded) { stats.discarded++; return; }
  if (v.sense) {
    if (v.sense.via === 'ctx') stats.ctx++; else stats.picked++;
    if (v.sense.meaningCheck === 'doubt') stats.doubt++;
    return;
  }
  if (v.senseDiscarded) stats.discarded++;
  if (v.meaningCheck === 'doubt') stats.doubt++;
}

// ───────────────────────── 토큰 조립(§4.4) ─────────────────────────

/**
 * 토큰 하나의 검수 결과 — { meaning?, via?, meaningCheck? } 또는 null(현행 pickZhMeaning 그대로).
 * 사전 키가 표면형과 다른 토큰(이합사 조각 sep_link 등)에는 적용하지 않는다: 후보는 표면형 행에서 왔다.
 * 문맥 뜻(ctx)은 토큰에만 남고 사전 행에 쓰지 않는다(공유 사전 오염 방지 — 라우트 쓰기 경로 무변경).
 */
export function resolveZhTokenSense(pick, token) {
  if (!pick || !token) return null;
  if ((token.sep_link || token.base_form) !== token.text) return null;
  if (pick.sense?.meaning) {
    return { meaning: pick.sense.meaning, via: pick.sense.via, ...(pick.sense.meaningCheck ? { meaningCheck: pick.sense.meaningCheck } : {}) };
  }
  if (pick.meaningCheck) return { meaningCheck: pick.meaningCheck };
  return null;
}

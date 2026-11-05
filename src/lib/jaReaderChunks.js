// 일본어 읽기 화면의 「누르는 덩어리」 — 오너 확정 C2(판 2, 2026-11-05 KST, JA-UNITS-001).
//
// - 분석 결과(processed_json) · 토큰 id · 본문 칸은 그대로 둔다. 화면은 조각마다 칸을 그리고, 누르면 덩어리 전체를 고른다.
//   그래서 줄은 조각 사이에서도 바뀌어 덩어리가 통째로 다음 줄로 넘어가며 빈자리를 남기지 않는다(LINE-BREAK-001 무변경).
// - 동사 · 형용사 활용 사슬 = 단어 덩어리(食べています). 저장 키 = 첫 내용어 기본형(食べる) — 단어장 · FSRS 경로 그대로.
// - 굳은 문형(かもしれない · なければならない) = 문형 덩어리. 정본 문형 사전(bunkei) 항목을 가리키고, 저장은 문법 복습 담기(savePatternReview).
// - 묶는 규칙은 정본 groupTokensToUnits(jaWordUnits.js — 듣기 자막과 공용)를 그대로 쓴다. 읽기 화면은 명사 뒤 です를 떼어 둔다(学生 | です).
import { groupTokensToUnits } from './jaWordUnits.js';

// 활용 조각 풀이(카드의 「이 모양」 줄) — 표면 · 기본형으로 고른다. 모르면 풀이 없이 조각만.
const GLOSS_BY_SURFACE = { たら: '~면', だら: '~면', ば: '~면', て: '~고 · ~서', で: '~고 · ~서', ず: '~지 않고', なけれ: '~지 않으면' };
const GLOSS_BY_BASE = {
  ます: '정중', です: '정중', た: '과거', ん: '부정', ない: '부정', ぬ: '부정',
  いる: '~고 있다', ある: '~어 있다', おく: '~어 두다', しまう: '~어 버리다', みる: '~어 보다', いく: '~어 가다', くる: '~어 오다',
  たい: '~고 싶다', れる: '수동 · 가능', られる: '수동 · 가능', せる: '사역', させる: '사역', う: '~자 · ~겠지', よう: '~자 · ~겠지',
  なる: '~게 되다', くれる: '~어 주다', もらう: '~어 받다', あげる: '~어 주다',
};

/** 덩어리 안 n번째 조각의 풀이(첫 조각은 null — 카드가 기본형을 보인다). */
export function partGloss(token, index) {
  if (index === 0) return null;
  const surface = String(token?.text ?? '');
  const base = token?.base_form || surface;
  return GLOSS_BY_SURFACE[surface] ?? GLOSS_BY_BASE[base] ?? null;
}

/**
 * 사슬 안에서 찾는 정본 문형 — 기본형 열로 맞춘다. ref = 문형 사전 항목(급수 · 공식 표기 그대로).
 * set = 굳은 문형: 따로 문형 덩어리 · 문법 복습 담기. conj = 활용 문형: 단어 덩어리 카드의 문법 줄로만 잇는다.
 * 항목을 늘릴 때는 bunkei에 있는 표기만 쓴다(jaReaderChunks 계약 시험이 대조한다).
 */
export const JA_CHUNK_PATTERNS = Object.freeze([
  { bases: ['かも', 'しれる'], lemma: 'かもしれない', kind: 'set', ref: { level: 'N4', pattern: '〜かもしれない' } },
  { bases: ['か', 'も', 'しれる'], lemma: 'かもしれない', kind: 'set', ref: { level: 'N4', pattern: '〜かもしれない' } },
  { bases: ['ない', 'ば', 'なる'], lemma: 'なければならない', kind: 'set', ref: { level: 'N4', pattern: '〜なければならない・〜なきゃ' } },
  { bases: ['て', 'いる'], kind: 'conj', ref: { level: 'N5', pattern: '〜て います' } },
  { bases: ['で', 'いる'], kind: 'conj', ref: { level: 'N5', pattern: '〜て います' } },
  { bases: ['ます', 'ん', 'です', 'た'], kind: 'conj', ref: { level: 'N5', pattern: '〜ませんでした' } },
  { bases: ['です', 'た'], kind: 'conj', ref: { level: 'N5', pattern: '〜でした' } },
]);

const baseOf = (t) => t?.base_form || t?.text;
function findPattern(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    for (const p of JA_CHUNK_PATTERNS) {
      if (p.bases.every((b, k) => baseOf(tokens[i + k]) === b)) return { ...p, at: i };
    }
  }
  return null;
}

const partsOf = (tokens, from = 0) => tokens.map((t, i) => ({ text: String(t.text ?? ''), base: baseOf(t), gloss: partGloss(t, i + from) }));

/**
 * 자료의 줄마다 덩어리를 만든다(순수).
 * @returns {Map<string, object>} 덩어리에 든 토큰 id → 덩어리 { kind:'word'|'pattern', ids, surface, base, parts, ref, headSurface }
 *   덩어리가 아닌 토큰(한 칸 낱말 · 조사 · 부호)은 들어 있지 않다 — 지금처럼 그 토큰 하나를 고른다.
 */
export function buildReaderChunks(sequence, dictionary) {
  const chunkOf = new Map();
  if (!Array.isArray(sequence) || !dictionary) return chunkOf;
  const runs = [];
  let run = [], line = null;
  for (const id of sequence) {
    const m = /^id_(\d+)_/.exec(id);
    const tok = dictionary[id];
    // 줄 · 분석 실패 칸을 넘어 묶지 않는다.
    if (!m || !tok || tok.failed) { if (run.length) runs.push(run); run = []; line = null; continue; }
    if (line !== null && m[1] !== line && run.length) { runs.push(run); run = []; }
    line = m[1];
    run.push({ ...tok, __id: id });
  }
  if (run.length) runs.push(run);
  const put = (chunk) => { for (const id of chunk.ids) chunkOf.set(id, chunk); };
  const make = (kind, tokens, extra) => ({
    kind, ids: tokens.map((t) => t.__id), surface: tokens.map((t) => String(t.text ?? '')).join(''), ...extra,
  });
  for (const r of runs) {
    for (const u of groupTokensToUnits(r, { copulaAfterNoun: false })) {
      const toks = u.tokens;
      const pat = findPattern(toks);
      if (u.expression) {
        // 문형으로 시작하는 사슬(かもしれません) — 통째로 문형 덩어리. 표현 몫은 한 조각(かもしれ = かもしれない).
        const n = u.expression.bases.length;
        const lemmaPart = { text: toks.slice(0, n).map((t) => t.text).join(''), base: u.base, gloss: null };
        put(make('pattern', toks, {
          base: u.base, headSurface: '',
          parts: u.surface === u.base ? [{ ...lemmaPart, text: u.surface }] : [lemmaPart, ...partsOf(toks.slice(n), 1)],
          ref: pat?.ref || JA_CHUNK_PATTERNS.find((p) => p.lemma === u.base)?.ref || null,
        }));
        continue;
      }
      if (pat?.kind === 'set' && pat.at > 0) {
        // 활용 + 굳은 문형(読ま | なければならない) — 앞은 단어 덩어리(두 조각 이상일 때만), 뒤는 문형 덩어리.
        const head = toks.slice(0, pat.at), tail = toks.slice(pat.at);
        if (head.length > 1) put(make('word', head, { base: u.base, headSurface: '', parts: partsOf(head), ref: null }));
        put(make('pattern', tail, { base: pat.lemma, headSurface: head.map((t) => t.text).join(''), parts: partsOf(tail, 1), ref: pat.ref }));
        continue;
      }
      if (toks.length < 2) continue;
      put(make('word', toks, { base: u.base, headSurface: '', parts: partsOf(toks), ref: pat?.kind === 'conj' ? pat.ref : null }));
    }
  }
  return chunkOf;
}

/** 덩어리를 고를 때 카드에 줄 토큰 — id는 첫 조각, 기본형 = 덩어리 기본형(단어 덩어리는 지금 첫 조각을 눌러 저장하던 것과 같은 키). */
export function chunkCardToken(dictionary, chunk) {
  const first = dictionary?.[chunk.ids[0]] || {};
  const pieces = chunk.ids.map((id) => dictionary?.[id] || {});
  return {
    token: {
      ...first,
      text: chunk.surface,
      furigana: pieces.some((t) => t.furigana) ? pieces.map((t) => t.furigana || t.text || '').join('') : null,
      base_form: chunk.base,
      ...(chunk.kind === 'pattern' ? { pos: '', meaning: '' } : null),
      __chunk: chunk,
    },
    id: chunk.ids[0],
  };
}

/** 정본 문형 사전 인덱스(patternIndex.loadPatternIndex 산출)에서 덩어리의 문형 항목을 찾는다. 없으면 null(링크 · 담기 없이). */
export function chunkPatternEntry(index, ref) {
  if (!index || !ref) return null;
  for (const bucket of index.values()) {
    const hit = bucket.find((e) => e.level === ref.level && e.pattern === ref.pattern);
    if (hit) return hit;
  }
  return null;
}

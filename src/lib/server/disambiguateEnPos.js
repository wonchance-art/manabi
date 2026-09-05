// 서버 전용 — 영어 겸류 품사·lemma 문맥 판별.
// wink-lemmatizer의 레거시 기본 lemma는 그대로 두고, 명사/동사/형용사 후보가 갈리거나
// 사전 후보 판정이 아직 끝나지 않은 occurrence만 Gemini 1회로 묶는다. 실패하거나 선택된
// lemma의 사전 행이 이번 요청에서 조회되지 않았으면 기존 base_form·pos·첫 뜻으로 폴백한다.

import { parseJsonLenient } from './fetchMeanings.js';
import { callLLM } from './llm.js';

const MAX_MARKS = 120;

export const EN_POS_LABELS = [
  '명사', '동사', '형용사', '부사', '전치사', '접속사',
  '관사', '대명사', '조동사', '감탄사', '수사',
];
const EN_POS_SET = new Set(EN_POS_LABELS);

const splitPos = (value) => String(value || '')
  .split('·')
  .map((pos) => pos.trim())
  .filter(Boolean);

export const enPosMarkKey = (lineIdx, tokenIdx) => `${lineIdx}:${tokenIdx}`;

export function hasEnPosMarker(meanings) {
  return Array.isArray(meanings) && meanings.some((meaning) =>
    meaning && Object.prototype.hasOwnProperty.call(meaning, 'en_pos_v'));
}

/** marker 없는 영어 gemini 행만 lazy backfill. user_verified는 어떤 경우에도 제외한다. */
export function needsEnPosBackfill(entry) {
  if (!entry || entry.source === 'user_verified') return false;
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  return meanings.length > 0 && !hasEnPosMarker(meanings);
}

function lemmaForPos(token, pos) {
  const candidates = token?.lemma_candidates || {};
  if (pos === '동사' || pos === '명사' || pos === '형용사') {
    return candidates[pos] || token?.base_form || String(token?.text || '').toLowerCase();
  }
  return candidates['기본'] || String(token?.text || '').toLowerCase() || token?.base_form;
}

function buildLemmaByPos(token) {
  return Object.fromEntries(EN_POS_LABELS.map((pos) => [pos, lemmaForPos(token, pos)]));
}

/**
 * POS별 후보 중 기본 base_form과 다른 사전 키를 모은다. 기본 키 조회에 덧붙이는 후보만
 * 반환하며, 기존 요청 cap 안에서 앞 occurrence부터 결정적으로 자른다.
 */
export function collectEnLemmaLookupForms(tokenizedLines, limit = 100) {
  const forms = [];
  const seen = new Set();
  for (const { tokens } of tokenizedLines || []) {
    for (const token of tokens || []) {
      if (!token?.lemma_candidates) continue;
      for (const lemma of Object.values(token.lemma_candidates)) {
        if (!lemma || lemma === token.base_form || seen.has(lemma)) continue;
        seen.add(lemma);
        forms.push(lemma);
        if (forms.length >= limit) return forms;
      }
    }
  }
  return forms;
}

/** occurrence key(lineIdx:tokenIdx)로 판별 대상을 수집한다. */
export function collectEnPosMarks(tokenizedLines, cache) {
  const marks = [];
  (tokenizedLines || []).forEach(({ tokens }, lineIdx) => {
    (tokens || []).forEach((token, tokenIdx) => {
      if (!token?.lemma_candidates) return; // 기호·수사는 현행 로컬 pos 유지
      const cached = cache.get(token.base_form);
      const cachedCandidates = splitPos(cached?.pos);
      const lemmaByPos = buildLemmaByPos(token);
      const lemmaVariants = new Set(Object.values(lemmaByPos).filter(Boolean));
      const shouldMark = !cached || needsEnPosBackfill(cached) ||
        cachedCandidates.length > 1 || lemmaVariants.size > 1;
      if (!shouldMark || marks.length >= MAX_MARKS) return;
      marks.push({
        key: enPosMarkKey(lineIdx, tokenIdx),
        lineIdx,
        tokenIdx,
        word: token.text,
        baseForm: token.base_form,
        lemmaByPos,
        cachedPos: cached?.pos || null,
      });
    });
  });
  return marks;
}

function buildEnPosPrompt(lines, marks) {
  const usedLineIdxs = [...new Set(marks.map((mark) => mark.lineIdx))];
  const lineNo = new Map(usedLineIdxs.map((idx, i) => [idx, i + 1]));
  const sentences = usedLineIdxs.map((idx) => `${lineNo.get(idx)}. ${lines[idx]}`).join('\n');
  const occurrences = marks.map((mark, i) => {
    const grouped = new Map();
    for (const [pos, lemma] of Object.entries(mark.lemmaByPos)) {
      if (!grouped.has(lemma)) grouped.set(lemma, []);
      grouped.get(lemma).push(pos);
    }
    const options = [...grouped.entries()]
      .map(([lemma, poses]) => `${poses.join('/')}=${lemma}`)
      .join(', ');
    return `${i + 1}. "${mark.word}" (문장 ${lineNo.get(mark.lineIdx)}, occurrence ${mark.tokenIdx + 1}; lemma: ${options})`;
  }).join('\n');
  return `다음 영어 문장의 표시된 각 occurrence에 대해 품사와 lemma를 판정하세요.

## 문장
${sentences}

## occurrence
${occurrences}

## 출력 형식 (목록과 순서·길이 정확히 일치)
[
  { "all": ["동사", "명사"], "pos": "동사", "base_form": "record" },
  { "all": ["명사"], "pos": "명사", "base_form": "saw" }
]

## 규칙
- all: 해당 표기가 일반적으로 갖는 품사 후보, 흔한 순 1~3개
- pos: 이 문장 occurrence의 실제 품사이며 반드시 all 중 하나
- base_form: occurrence 줄에 제시된 lemma 후보 중 pos에 대응하는 값만 사용
- 품사 명칭: ${EN_POS_LABELS.join('/')}
- 같은 줄의 같은 표기도 occurrence마다 독립 판정
- 설명/주석 금지, JSON만 출력`;
}

/** 요청당 Gemini flash-lite 최대 1회. 모든 실패는 빈 picks로 수렴한다. */
export async function disambiguateEnPos(lines, marks, opts = {}) {
  const { deadlineMs = null } = opts;
  const picks = new Map();
  if (!marks.length) return { picks, httpCalls: 0 };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || (deadlineMs != null && Date.now() >= deadlineMs)) {
    return { picks, httpCalls: 0 };
  }

  let httpCalls = 0;
  try {
    httpCalls = 1;
    // light 티어 1회 — 판별기 관례: 재시도 0·Groq 폴백 없음(R1 동작 무변경), 실패는 빈 결과로 수렴
    const { text } = await callLLM('light', buildEnPosPrompt(lines, marks), {
      temperature: 0, timeoutMs: 15_000, groq: false, route: 'disambiguateEnPos',
    });
    const parsed = parseJsonLenient(text);
    if (!Array.isArray(parsed) || parsed.length !== marks.length) {
      console.warn('[disambiguateEnPos] length mismatch', parsed?.length, marks.length);
      return { picks, httpCalls };
    }
    parsed.forEach((entry, i) => {
      const mark = marks[i];
      const rawAll = Array.isArray(entry?.all) ? entry.all : [];
      if (rawAll.length < 1 || rawAll.length > 3 || rawAll.some((pos) => typeof pos !== 'string')) return;
      const all = rawAll.map((pos) => pos.trim());
      if (new Set(all).size !== all.length || all.some((pos) => !EN_POS_SET.has(pos))) return;
      const pos = typeof entry?.pos === 'string' ? entry.pos.trim() : '';
      const baseForm = typeof entry?.base_form === 'string' ? entry.base_form.trim().toLowerCase() : '';
      if (!pos || !all.includes(pos) || !baseForm) return;
      if (mark.lemmaByPos[pos] !== baseForm) return;
      picks.set(mark.key, { all, pos, base_form: baseForm });
    });
  } catch (err) {
    console.warn('[disambiguateEnPos] failed:', err?.message);
  }
  return { picks, httpCalls };
}

function pickMeaning(meanings, pos) {
  if (!Array.isArray(meanings) || meanings.length === 0) return '';
  const matched = pos ? meanings.find((meaning) => meaning?.pos === pos && meaning?.meaning) : null;
  return matched?.meaning || meanings[0]?.meaning || '';
}

/**
 * 문맥 pick을 실제 조회된 사전 행에만 적용한다. 후보 행이 없으면 전 필드를 현행 값으로 유지한다.
 */
export function resolveEnTokenContext({ token, pick, cache }) {
  const fallbackEntry = cache.get(token.base_form);
  const pickedEntry = pick?.base_form ? cache.get(pick.base_form) : null;
  if (!pick || !pickedEntry) {
    return {
      baseForm: token.base_form,
      entry: fallbackEntry,
      pos: fallbackEntry?.pos || token.pos,
      posAll: null,
      meaning: fallbackEntry?.meanings?.[0]?.meaning || '',
      fallback: true,
    };
  }
  const posAll = pick.all.length > 1 ? pick.all.join('·') : null;
  return {
    baseForm: pick.base_form,
    entry: pickedEntry,
    pos: pick.pos,
    posAll,
    meaning: pickMeaning(pickedEntry.meanings, pick.pos),
    fallback: false,
  };
}

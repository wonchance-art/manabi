// 서버 전용 — 중국어 품사 문맥 판별.
// 중국어는 겸류사(한 단어가 명사·동사 등 여러 품사로 두루 쓰임)가 흔한데, jieba는 사전 등재어에
// 문맥과 무관하게 단어당 한 태그만 단다(실측: 工作은 我在工作에서도 vn, 计划은 我计划去北京에서도 n,
// 希望은 我有一个希望에서도 v). 캐시(morpheme_dictionary) pos 우선 병합까지 겹치면 첫 등재 품사가
// 박제된다 — 병음 박제(#1004)와 같은 구조의 문제라 같은 방식(문장 문맥 산출)으로 푼다.
// 결정적 해법이 없으므로(jieba 태그가 사전 고정) 명사/동사/형용사 계열 한자어만 골라 요청당
// Gemini flash-lite 1회에 "사전상 품사 후보 전체 + 이 문장에서의 품사"를 묻는다.
// 실패·타임아웃·키 없음이면 빈 결과 — 기존 pos 폴백으로 그대로 동작한다(그레이스풀 디그레이드).

import { parseJsonLenient } from './fetchMeanings.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

// 판별 대상 품사 — 명·동·형 계열과 jieba 겸류 라벨(vn·vd·an·ad의 한국어 표기).
// 대명사·조사·전치사·수사·양사·지명·인명 등은 품사가 안정적이라 묻지 않는다(호출 크기 절감).
const MARKABLE_POS = new Set([
  '명사', '동사', '형용사',
  '명사성 동사', '부사성 동사', '명사성 형용사', '부사성 형용사',
]);
const HAS_HANZI = /[一-鿿]/;
// 요청당 판별 단어 상한 — /api/analyze 캡(100줄×200자) 최악 케이스에서 프롬프트 폭발 방지.
// 초과분은 이번 요청에서 기존 pos로 표시되고 다음 분석에서 다시 후보가 된다.
const MAX_MARKS = 120;

const splitPos = (s) => String(s || '').split('·').map((x) => x.trim()).filter(Boolean);

const markKey = (lineIdx, word) => `${lineIdx}:${word}`;

/**
 * 판별할 (줄, 단어) 목록 수집.
 * 대상: 한자를 포함하고, jieba pos·캐시 pos 중 하나라도 명/동/형 계열이거나 품사 미상인 토큰.
 * 같은 줄의 중복 단어는 한 번만 — 드물게 한 줄에서 같은 단어가 다른 품사로 두 번 쓰여도
 * 첫 판정을 공유한다(단순화 트레이드오프).
 * @param {Array<{tokens: Array}>} tokenizedLines
 * @param {Map<string, {pos}>} cache - base_form → morpheme_dictionary 행
 * @returns {Array<{lineIdx, word, key}>}
 */
export function collectZhPosMarks(tokenizedLines, cache) {
  const marks = [];
  const seen = new Set();
  tokenizedLines.forEach(({ tokens }, lineIdx) => {
    for (const t of tokens || []) {
      if (!t?.text || !HAS_HANZI.test(t.text)) continue;
      const cachedPos = cache.get(t.base_form)?.pos;
      // '기호' 라벨 무시: 한자 토큰이 기호일 수 없다 — x-태그 오분류 시절(这宗·笔在가
      // 기호로 캐시됨)의 잔재가 판별을 막지 않게 미상으로 되돌려 마크한다.
      const labels = [
        ...splitPos(cachedPos),
        ...splitPos(t.pos_all),
        ...(t.pos ? [t.pos] : []),
      ].filter((p) => p !== '기호');
      // 라벨이 하나도 없으면 품사 미상(jieba 미지 태그 + 캐시 없음) — 판별로 채울 기회를 준다.
      if (labels.length > 0 && !labels.some((p) => MARKABLE_POS.has(p))) continue;
      const key = markKey(lineIdx, t.text);
      if (seen.has(key)) continue;
      seen.add(key);
      // 단어성 판정 대상: 품사 단서가 전혀 없는 다자 토큰 — jieba x-병합 OOV.
      // 실측상 우연 병합(笔在·这宗)과 실제 신조어(社恐)가 섞여 있어 기계 분리는 불가,
      // 문맥 판별기가 함께 판정한다(같은 호출 — 추가 비용 없음).
      const oov = labels.length === 0 && [...t.text].length >= 2;
      marks.push({ lineIdx, word: t.text, key, ...(oov ? { oov: true } : {}) });
    }
  });
  return marks.slice(0, MAX_MARKS);
}

function buildZhPosPrompt(lines, marks) {
  // 판별 단어가 있는 줄만 실어 프롬프트를 줄인다(원 줄 번호 → 표시 번호 재부여).
  const usedLineIdxs = [...new Set(marks.map((m) => m.lineIdx))];
  const lineNo = new Map(usedLineIdxs.map((idx, i) => [idx, i + 1]));
  const sentenceList = usedLineIdxs.map((idx) => `${lineNo.get(idx)}. ${lines[idx]}`).join('\n');
  const wordList = marks
    .map((m, i) => `${i + 1}. "${m.word}" (문장 ${lineNo.get(m.lineIdx)})${m.oov ? ' [단어성 판정]' : ''}`)
    .join('\n');
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
  ...
]

## 규칙
- all: 이 단어가 중국어에서 일반적으로 갖는 품사 후보 (흔한 순, 1~3개)
- pos: 지정된 문장의 맥락에서 이 단어가 실제로 쓰인 품사 — 반드시 all 중 하나
- split: [단어성 판정] 표시 항목만 — 이 표기가 실제 쓰이는 한 단어(신조어·전문어·고유명사
  포함)면 split을 넣지 말 것. 별개 단어들이 우연히 이웃해 붙은 조합일 때만 순서대로
  분해해 각 부분의 표기(t)와 그 문장에서의 품사(pos)를 적을 것 (부분들을 이으면 원 표기와
  정확히 일치해야 함)
- 품사 명칭: 명사/동사/형용사/부사/전치사/접속사/조사/대명사/양사/수사/감탄사/성어/지명/인명/고유명사
- 설명/주석 금지, JSON만 출력`;
}

/**
 * 판별 실행 — 요청당 Gemini flash-lite 1회.
 * @param {string[]} lines - 요청의 원 줄 배열(marks의 lineIdx와 같은 인덱스 공간)
 * @param {Array<{lineIdx, word, key}>} marks - collectZhPosMarks 결과
 * @param {object} [opts]
 * @param {number|null} [opts.deadlineMs] - 이 시각(epoch ms)을 넘겼으면 호출 자체를 생략
 * @returns {Promise<Map<string, {pos: string, all: string[]}>>} mark.key → 판정
 */
export async function disambiguateZhPos(lines, marks, opts = {}) {
  const { deadlineMs = null } = opts;
  const picks = new Map();
  if (!marks.length) return picks;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return picks; // 뜻 조회와 달리 없어도 치명 아님 — 기존 pos로 폴백
  if (deadlineMs != null && Date.now() >= deadlineMs) return picks;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildZhPosPrompt(lines, marks) }] }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) {
      console.warn('[disambiguateZhPos] HTTP', res.status);
      return picks;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return picks;
    const parsed = parseJsonLenient(text);
    if (!Array.isArray(parsed) || parsed.length !== marks.length) {
      console.warn('[disambiguateZhPos] length mismatch', parsed?.length, marks.length);
      return picks;
    }
    parsed.forEach((entry, i) => {
      const mark = marks[i];
      const all = Array.isArray(entry?.all)
        ? entry.all.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim().slice(0, 20)).slice(0, 4)
        : [];
      const pos = typeof entry?.pos === 'string' ? entry.pos.trim().slice(0, 20) : '';
      // 단어성 판정: 유효한 분해(부분 연결 == 원 표기)가 오면 분리 verdict 우선 —
      // 병합 비단어에는 pos/all이 무의미하다. 검증 실패 시 분해는 버리고 pos 경로 폴백.
      const parts = mark.oov ? validateSplitParts(entry?.split, mark.word) : null;
      if (parts) {
        picks.set(mark.key, { pos: pos && all.includes(pos) ? pos : null, all, parts });
        return;
      }
      if (!pos || !all.includes(pos)) return; // pos∉all은 모델 위반 — 버리고 이 단어는 폴백
      picks.set(mark.key, { pos, all });
    });
  } catch (err) {
    console.warn('[disambiguateZhPos] failed:', err?.message);
  }
  return picks;
}

/** split 응답 검증 — 부분 2개 이상, 표기 비지 않음, 이어붙이면 원 표기와 정확히 일치. */
function validateSplitParts(split, word) {
  if (!Array.isArray(split) || split.length < 2) return null;
  const parts = split.map((p) => ({
    t: typeof p?.t === 'string' ? p.t.trim() : '',
    pos: typeof p?.pos === 'string' && p.pos.trim() ? p.pos.trim().slice(0, 20) : null,
  }));
  if (parts.some((p) => !p.t)) return null;
  if (parts.map((p) => p.t).join('') !== word) return null;
  return parts;
}

/**
 * 우연 병합 토큰을 판정 결과대로 부분 토큰들로 분해(순수 함수 — 라우트 조립부에서 사용).
 * 병음은 병합 토큰의 음절열(공백 구분, 1자=1음절)을 부분 글자 수만큼 나눠 갖는다.
 * 부분의 뜻은 캐시에 있으면 붙고 없으면 다음 요청에서 백필된다(그레이스풀).
 */
export function splitZhToken(token, parts) {
  const sylls = String(token.furigana || '').split(' ').filter(Boolean);
  let si = 0;
  return parts.map((p) => {
    const chars = [...p.t];
    const furigana = sylls.slice(si, si + chars.length).join(' ');
    si += chars.length;
    return { text: p.t, base_form: p.t, furigana, pos: p.pos };
  });
}

/**
 * 토큰 하나의 최종 pos / pos_all 결정(순수 함수 — 라우트 조립부에서 사용).
 * 후보 집합 우선순위: 문맥 판별 all > 사전 다중 pos('·' 연결) > jieba 겸류 확장(pos_all).
 * pos 우선순위: 문맥 pick > 후보 첫 항목(흔한 순) > 캐시 pos > jieba pos(기존 동작과 동일).
 * @returns {{pos: string|null, posAll: string|null}} posAll은 후보 2개 이상일 때만('·' 연결)
 */
export function resolveZhTokenPos({ pick, cachedPos, tokenPos, tokenPosAll }) {
  const fromPick = pick?.all?.length ? pick.all : null;
  const cachedList = splitPos(cachedPos);
  const jiebaList = splitPos(tokenPosAll);
  const candidates = fromPick ?? (cachedList.length > 1 ? cachedList : null) ?? (jiebaList.length > 1 ? jiebaList : null);
  const pos = pick?.pos ?? candidates?.[0] ?? (cachedPos || tokenPos || null);
  const posAll = candidates && candidates.length > 1 ? candidates.join('·') : null;
  return { pos, posAll };
}

/**
 * 뜻 정렬 문맥화 — 짚힌 품사와 일치하는 뜻을 우선 선택.
 * 뜻에 pos 태그가 없거나(레거시 행) 일치가 없으면 첫 뜻(기존 동작)으로 폴백.
 * @param {Array<{meaning, pos?}>} meanings - morpheme_dictionary 행의 meanings
 * @param {string|null} pos - resolveZhTokenPos가 짚은 문맥 품사
 */
export function pickZhMeaning(meanings, pos) {
  if (!Array.isArray(meanings) || meanings.length === 0) return '';
  if (pos) {
    const matched = meanings.find((m) => m?.pos === pos && m?.meaning);
    if (matched) return matched.meaning;
  }
  return meanings[0]?.meaning || '';
}

/**
 * 레거시 자가 치유 ① — 다중 품사('·') 행인데 뜻에 pos 태그가 하나도 없으면 뜻 재조회 대상.
 * 재조회는 기존 미싱 경로(fetchMeaningsForMissing)를 그대로 타고, 새 프롬프트가 뜻별 pos를
 * 붙여 upsert한다. user_verified는 오너 확정이라 덮지 않는다.
 * (프롬프트 불이행으로 태그가 안 붙으면 다음 요청에 다시 대상이 되지만, temperature 0 +
 *  명시 형식이라 실제 반복은 드물고 MAX_MISSING·deadline 캡 안에서만 돈다.)
 */
export function needsZhMeaningPosRefresh(entry) {
  if (!entry || entry.source === 'user_verified') return false;
  if (splitPos(entry.pos).length < 2) return false;
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  return meanings.length > 0 && !meanings.some((m) => m?.pos);
}

/**
 * 레거시 자가 치유 ② — 문맥 판별이 알아낸 다중 후보(pick.all)를 아직 단일 pos로 남아 있는
 * gemini 행에 기록할 그룹을 만든다(호출부가 fire-and-forget update). 다음 요청부터 캐시가
 * 후보를 알게 되고, ①이 뜻 pos 백필을 이어간다 — 요청 2회로 레거시 행이 완전 치유된다.
 * 같은 단어가 여러 줄에서 마크됐으면 첫 판정만 쓴다(temperature 0이라 사실상 동일).
 * @returns {Array<{pos: string, baseForms: string[]}>} pos 후보 문자열별 업데이트 그룹
 */
export function buildZhPosWriteback(marks, picks, cache) {
  const byPos = new Map();
  const seen = new Set();
  for (const m of marks) {
    if (seen.has(m.word)) continue;
    const pick = picks.get(m.key);
    if (!pick || pick.all.length < 2) continue;
    seen.add(m.word);
    const entry = cache.get(m.word); // 중국어는 base_form === 표면형
    if (!entry || entry.source !== 'gemini') continue;
    if (splitPos(entry.pos).length >= 2) continue;
    const joined = pick.all.join('·');
    if (!byPos.has(joined)) byPos.set(joined, []);
    byPos.get(joined).push(m.word);
  }
  return [...byPos.entries()].map(([pos, baseForms]) => ({ pos, baseForms }));
}

export { markKey as zhPosMarkKey };

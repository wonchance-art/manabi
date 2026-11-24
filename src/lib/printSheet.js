// 인쇄 학습지(PRINT-SHEET-001 — 오너 승인 목업 2026-11-16 KST: A 본문만 · B 해석용, 번역이 없는 문단은 빈 줄).
// 순수 모듈 — 조회 · AI 호출 없음. 화면(src/views/PrintPage.jsx)은 뷰어가 이미 쓰는 기록만 넘긴다:
//   문단 = 뷰어 줄 묶음(readerLineGroups) · 뜻풀이 후보 = [문장] 탭 단어별 뜻(sentenceWordGlosses)과 같은 규칙,
//   아는 단어 = 뷰어 「모르는 단어만」과 같은 판정(pronHiddenFor — 아는 단어 표시 또는 담은 단어면 익숙한 말),
//   번역 = 교재 번역 맵(metadata.translations, lookupTranslation) → 이 기기에 남은 뷰어 번역(viewer_tx 키, 읽기만).
// 번역을 새로 만들지 않는다(AI 0) — 없으면 빈 줄 두 줄이다. 계약: src/lib/__tests__/printSheet.test.js.
import { readerLineGroups } from './readerSections.js';
import { computeHeadingLevels } from './headingHeuristics.js';
import { normalizeRefWordKey } from './refWordNormalize.js';
import { pickableSentenceUnits } from './sentenceNav.js';
import { locateLineTokens } from './viewerSentenceLine.js';
import { sentenceWordGlosses, sentenceTranslationParts } from './viewerSentenceGlosses.js';
import { lookupTranslation } from './bilingualSplit.js';
import { findIndexedVocabulary } from './vocabularyDueIndex.js';
import { normalizeKnownWord } from './knownWordControl.js';
import { exclusionWord } from './vocabularyExclusion.js';
import { pronHiddenFor } from './readingSheet.js';
import { zhHskLevelLabel, zhHskLevelOf } from './zhHskLevel.js';
import {
  attributionParts, literatureAttributionParts, materialSource, pdSiteAttributionParts,
  standardEbooksAttributionParts, wikisourceAttributionParts,
} from './videoAttribution.js';

/** 문단마다 싣는 뜻풀이 상한 — 오른쪽 칸이 원문 높이를 넘지 않는 수(목업 B). */
export const GLOSS_MAX = 8;
export const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
export const PRINT_KINDS = Object.freeze([['text', '본문만'], ['study', '해석용']]);
export const PRINT_RUBY = Object.freeze([['all', '전부'], ['unknown', '모르는 단어만'], ['none', '없음']]);
export const PRINT_SIZES = Object.freeze([['s', '작게'], ['m', '보통'], ['l', '크게']]);
export const PRINT_PAPERS = Object.freeze([['A4', 'A4'], ['B5', 'B5']]);
export const PRINT_SIZE_PT = Object.freeze({ s: 10.5, m: 12, l: 14 });
// B5 = JIS B5(182×257mm) — 국내 · 일본 학습지 · 문제집 판형. ISO B5(176×250)가 아니다(한국 복사기 「B5」 = JIS).
export const PRINT_PAPER_CSS = Object.freeze({ A4: 'A4', B5: '182mm 257mm' });

// 뜻풀이에 싣지 않는 것 — 문법 기능어 · 부호 · 보조 용언. [문장] 탭 단어 줄(조사 · 기호 제외)보다 좁힌다: 종이 한 칸에 8개뿐이다.
const PRINT_SKIP_POS = new Set(['조동사', '어기조사', '관사', '전치사', '접속사', '접두사', '접미', '허사', '기타', '방위사', '연체사', '대명사', '양사', '수사']);
// 영어 · 프랑스어 기능어 — 분석기가 동사 · 형용사 · 부사로 달아 품사로는 못 거르는 말(be · have · do · 소유 한정사 · 부정 · 정도 부사 · 대명사).
// 운영 실측(2026-11-18 KST, VOA 공개 자료 인쇄): 「is · their · not · very · now」가 뜻풀이 8칸을 차지했다.
const LATIN_FUNCTION_WORDS = new Set([
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'shall', 'should', 'may', 'might', 'must', 'a', 'an', 'the', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'not', 'no', 'and', 'or', 'but', 'so', 'if',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as', 'very', 'too', 'also', 'just', 'now', 'then', 'there', 'here',
  'than', 'what', 'who', 'which', 'when', 'where', 'how', 'all', 'some', 'any', 'more', 'most',
  'le', 'la', 'les', "l'", 'un', 'une', 'des', 'du', 'de', "d'", 'et', 'ou', 'mais', 'je', "j'", 'tu', 'il', 'elle', 'on', 'nous',
  'vous', 'ils', 'elles', 'me', "m'", 'te', "t'", 'se', "s'", 'ce', "c'", 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'notre', 'votre', 'leur', 'leurs', 'ne', "n'", 'pas', 'être', 'avoir', 'est', 'sont', 'a', 'ont', 'que', "qu'",
  'qui', 'en', 'à', 'au', 'aux', 'dans', 'sur', 'pour', 'par', 'avec', 'y', 'très', 'aussi',
]);
const LIGHT_BASE = new Set(['する', 'いる', 'ある', 'なる', 'くれる', 'もらう', 'あげる', 'みる', 'おく', 'しまう', 'ます', 'です', 'だ', 'た']);
// 줄 앞 마크다운 제목 표지(# · ## · ###) — 뷰어 cleanLineText와 같은 규칙.
const HEADING_MARK = /^(#{1,3})\s/;

/** 주소 값 → 고른 값(목록 밖이면 기본값). */
export function pickPrintOption(value, list, fallback) {
  return list.some(([key]) => key === value) ? value : fallback;
}

/**
 * processed_json → 인쇄 문단. 뷰어와 같은 줄 묶음(원문 한 줄 = 한 문단)이고, 토큰 사이 원문 간격(영어 · 프랑스어 띄어쓰기)을 gap으로 싣는다.
 * 제목 줄(# 표지 · 휴리스틱 — 뷰어 computeHeadingLevels)은 heading 단계를 달고 # 표지 토큰은 뺀다.
 * @returns {Array<{rawIdx:number, lineText:string, heading:number, tokens:Array<object & {key:string, gap:string}>}>}
 */
export function printParagraphs(json, rawText, { title = '' } = {}) {
  const dict = json?.dictionary;
  const rawLines = String(rawText ?? '').split('\n');
  const headings = computeHeadingLevels(rawLines);
  const out = [];
  for (const group of readerLineGroups(json?.sequence, dict)) {
    const raw = rawLines[group.rawIdx] ?? '';
    let tokens = group.tokenIds.map((key) => ({ ...dict[key], key })).filter((t) => typeof t.text === 'string' && t.text);
    const marked = HEADING_MARK.test(raw.trim());
    if (marked) while (tokens.length && /^[#\s]+$/u.test(tokens[0].text)) tokens = tokens.slice(1);
    if (!tokens.some((t) => t.text.trim())) continue;
    const spots = locateLineTokens(raw, tokens.map((t) => t.text));
    let prevEnd = null;
    tokens = tokens.map((t, i) => {
      const spot = spots[i];
      const gap = spot && prevEnd != null && spot.start > prevEnd ? raw.slice(prevEnd, spot.start).replace(/\s+/gu, ' ') : '';
      if (spot) prevEnd = spot.end;
      return { ...t, gap: i === 0 ? '' : gap };
    });
    const lineText = raw.trim().replace(HEADING_MARK, '');
    out.push({ rawIdx: group.rawIdx, lineText, heading: headings[group.rawIdx] || (marked ? HEADING_MARK.exec(raw.trim())[1].length : 0), tokens });
  }
  // 본문 첫 줄이 자료 제목과 같으면(가져올 때 첫 줄 = 제목인 자료가 많다) 종이 머리 제목과 겹쳐 두 번 찍히므로 뺀다.
  const same = (a, b) => String(a).replace(/\s+/gu, '') === String(b).replace(/\s+/gu, '');
  if (title && out[0] && same(out[0].lineText, title)) out.shift();
  return out;
}

/**
 * 뷰어와 같은 단어 상태 — 담은 단어(findIndexedVocabulary) · 아는 단어(아는 단어 표시 · 제외 묶음, knownWordSetOf 결과).
 * 손님은 둘 다 비어 있어 아무것도 익숙하지 않다.
 */
export function printWordState(token, { savedWords = null, knownWordSet = null, language } = {}) {
  const isSaved = !!findIndexedVocabulary(savedWords, token, language);
  const isKnown = !!(knownWordSet?.has(normalizeKnownWord(token?.text)) || knownWordSet?.has(exclusionWord(token)));
  return { isSaved: isSaved && !isKnown, isKnown };
}

/** 읽기 표시(전부 · 모르는 단어만 · 없음)를 이 토큰에 그릴지 — 뷰어 「발음 표기」와 같은 판정(pronHiddenFor). */
export function printRubyShown(ruby, state) {
  return !pronHiddenFor(ruby, state);
}

/** 뜻풀이 후보 — [문장] 탭 단어 줄과 같은 거르기(sentenceWordGlosses) 위에 인쇄 전용 기능어 · 보조 용언 거르기. */
function isPrintGlossToken(token, language) {
  if (!token || PRINT_SKIP_POS.has(token.pos) || token.failed) return false;
  if (LIGHT_BASE.has(token.base_form || token.text)) return false;
  if (language === 'English' || language === 'French') {
    const latin = (s) => String(s || '').toLowerCase().replace(/[’]/gu, "'").trim();
    if (LATIN_FUNCTION_WORDS.has(latin(token.base_form)) || LATIN_FUNCTION_WORDS.has(latin(token.text))) return false;
  }
  return /\p{L}/u.test(token.text || '');
}

/** 뜻 한 줄 — 여러 뜻(「a; b; c」)은 앞의 둘까지. 종이 한 칸이 한 줄로 끝나게. */
export function glossMeaning(meaning) {
  const parts = String(meaning || '').split(/\s*[;；]\s*/u).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 2).join('; ');
}

/**
 * 자료 급수 → 난이도 순위(PRINT-GLOSS-002). 일본어 N5 = 1 … N1 = 5 · 중국어 HSK n = n(7–9 = 7) · 영어 · 프랑스어 A1 = 1 … C2 = 6.
 * 급수 표기가 없으면 null.
 */
export function materialLevelRank(language, level) {
  const s = String(level || '');
  if (language === 'Japanese') { const m = /N\s*([1-5])/iu.exec(s); return m ? 6 - Number(m[1]) : null; }
  if (language === 'Chinese') {
    // 운영 저장 값은 LEVELS 그대로 「H5 고급」 · 「OT 입문」이다(LIB-FIX-001 실측 2026-11-24 KST — 전에는 「HSK n」 · 「n급」만 읽어
    // 중국어 자료 전부가 급수 없음 → 기본값 2로 떨어졌다). OT(입문)는 HSK 1급보다 아래라 1 — 거르는 낱말이 없다.
    if (/^OT\b/iu.test(s)) return 1;
    const m = /HSK\s*([1-9])/iu.exec(s) || /^H\s*([1-9])\b/iu.exec(s) || /^([1-6])\s*급/u.exec(s);
    return m ? Math.min(Number(m[1]), 7) : null;
  }
  if (language === 'English' || language === 'French') {
    const m = /\b(A0|A1|A2|B1|B2|C1|C2)\b/iu.exec(s);
    return m ? { A0: 1, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }[m[1].toUpperCase()] : null;
  }
  return null;
}

/** 단어 난이도 순위 — materialLevelRank와 같은 눈금. 표에 없으면 null(고유명사 · 표 밖 낱말 — 어려운 쪽으로 둔다). */
export function wordLevelRank(language, word, { zhLevels = null, jaLevels = null, latinLevels = null } = {}) {
  if (language === 'Chinese') { const n = zhHskLevelOf(word, zhLevels); return Number.isInteger(n) ? n : null; }
  if (language === 'Japanese') { const n = jaLevels?.get?.(word); return Number.isInteger(n) && n >= 1 && n <= 5 ? 6 - n : null; }
  if (language === 'English' || language === 'French') {
    const table = latinLevels?.[language === 'English' ? 'en' : 'fr'];
    const key = normalizeRefWordKey(language === 'English' ? 'en' : 'fr', word);
    const n = table?.get?.(key);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

/**
 * 해석용 뜻풀이 — 문단마다 모르는 내용어를 GLOSS_MAX개까지. 앞 문단에서 풀이한 말(같은 사전 키)은 다시 싣지 않는다.
 * 난이도 기준(PRINT-GLOSS-002, 오너 「쉬운 거 다 적어버리는 거 아님? 기준이 없나」 2026-11-18 KST):
 * - rankOf(token, word)가 있으면 자료 급수(minRank)보다 쉬운 말(순위 < minRank)은 싣지 않는다 — N4 자료면 N5 단어, A2 자료면 A1 단어.
 * - 문단 안에서는 등장 순이 아니라 **어려운 순**으로 상한까지 고르고(표에 없는 말 = 가장 어려움), 번호는 본문 순서로 다시 매긴다.
 *   전에는 등장 순으로 8칸을 채워 문단 앞쪽 쉬운 말이 칸을 차지하고 뒤 문장은 뜻풀이가 없었다(「중간에 멈춤」).
 * isFamiliar(token) — 아는 단어 · 담은 단어(뷰어 「모르는 단어만」과 같은 판정)면 true.
 * 표제어: 중국어 = 사전 키(sentenceWordGlosses text), 그 밖 = 기본형(활용형 대신) · 읽기 = 그 기본형의 읽기(분석기 furigana가 기본형 읽기다).
 * @returns {Array<{items:Array<{key:string, tokenKey:string, word:string, reading:string, meaning:string, pos:string}>, refs:Map<string, number>}>}
 */
export function selectGlosses(paragraphs, { language, isFamiliar = () => false, max = GLOSS_MAX, rankOf = null, minRank = null } = {}) {
  const seen = new Set();
  return (paragraphs || []).map((paragraph) => {
    const dictionary = Object.fromEntries(paragraph.tokens.map((t) => [t.key, t]));
    const items = [];
    const refs = new Map();
    if (paragraph.heading) return { items, refs };
    const candidates = [];
    const inParagraph = new Set();
    for (const gloss of sentenceWordGlosses(dictionary, paragraph.tokens.map((t) => t.key), { language })) {
      const token = dictionary[gloss.tokenId];
      if (seen.has(gloss.key) || inParagraph.has(gloss.key) || !isPrintGlossToken(token, language) || isFamiliar(token)) continue;
      const head = language === 'Chinese' ? gloss.text : (token.base_form || token.text);
      const rank = rankOf ? rankOf(token, head) : null;
      if (rankOf && minRank != null && rank != null && rank < minRank) continue;
      inParagraph.add(gloss.key);
      candidates.push({ gloss, token, rank, order: candidates.length });
    }
    const chosen = rankOf
      ? [...candidates].sort((a, b) => (b.rank ?? Infinity) - (a.rank ?? Infinity) || a.order - b.order).slice(0, max).sort((a, b) => a.order - b.order)
      : candidates.slice(0, max);
    for (const { gloss, token } of chosen) {
      seen.add(gloss.key);
      const word = language === 'Chinese' ? gloss.text : (token.base_form || token.text);
      let reading = language === 'Chinese' ? gloss.reading
        : (token.furigana && token.furigana !== word && !String(token.furigana).startsWith('/') ? String(token.furigana) : '');
      // 가나 중심 본문(N5 문법 #1~#9 · 교재 1–9과): 「わたし」의 표제어는 기본형 「私」인데 후리가나가 없어 읽기 칸이 비었다(운영 실측 11/18).
      // 명사는 가나 표기 = 기본형 읽기이므로 그것을 읽기로 싣는다. 활용하는 말은 가나 표기 ≠ 기본형 읽기라 싣지 않는다.
      if (language === 'Japanese' && !reading && token.pos === '명사' && token.text !== word
        && /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(token.text || '') && /\p{Script=Han}/u.test(word)) reading = token.text;
      items.push({ key: gloss.key, tokenKey: gloss.tokenId, word, reading, meaning: glossMeaning(gloss.meaning), pos: token.pos || '' });
      refs.set(gloss.tokenId, items.length);
    }
    return { items, refs };
  });
}

/** 단어 급수 라벨 — 중국어 HSK 2026(zhHskLevel 정본), 일본어 JLPT(단어 페이지 찾기 색인 표제어 → N5–N1). 그 밖 · 표에 없음 = null. */
export function printLevelLabel(language, word, { zhLevels = null, jaLevels = null } = {}) {
  if (language === 'Chinese') return zhHskLevelLabel(zhHskLevelOf(word, zhLevels));
  if (language === 'Japanese') {
    const level = jaLevels?.get?.(word);
    return Number.isInteger(level) && level >= 1 && level <= 5 ? `N${level}` : null;
  }
  return null;
}

/** 뷰어 문장 단위(지정 · [문장] 탭 · 번역 키가 쓰는 단위)를 원문 줄 번호별로. */
export function sentencesByLine(json, rawText, language) {
  const rawLines = String(rawText ?? '').split('\n');
  const units = pickableSentenceUnits(readerLineGroups(json?.sequence, json?.dictionary), rawLines, { dictionary: json?.dictionary, language });
  const map = new Map();
  for (const unit of units) {
    if (!map.has(unit.rawIdx)) map.set(unit.rawIdx, []);
    map.get(unit.rawIdx).push(unit);
  }
  return map;
}

/** 교재 번역 맵 — 줄 전체가 있으면 그것, 없으면 줄의 모든 문장이 있을 때만 이어 붙인다(정확 일치만 — 부분 추측 없음). */
export function bookTranslation(translations, paragraph, units = []) {
  const line = lookupTranslation(translations, paragraph?.lineText);
  if (line) return line;
  if (!units.length) return null;
  const parts = units.map((unit) => lookupTranslation(translations, unit.text));
  return parts.every(Boolean) ? parts.join(' ') : null;
}

/** 기기 사본(viewer_tx)에 남은 뷰어 번역 결과 → 번역 줄만(맥락 · 말투 · 교재 표시 줄은 뺀다 — 뷰어 [문장] 탭과 같은 분해). */
export function cachedTranslationText(value) {
  if (typeof value !== 'string' || !value || value.startsWith('\u0000')) return null;
  const text = sentenceTranslationParts(value).translation.join(' ').trim();
  return text || null;
}

/**
 * 문단 번역 — 교재 맵 → 이 기기의 뷰어 번역(문장마다, 전부 있을 때만). 없으면 null(빈 줄 두 줄).
 * keyOf(sentence) = 뷰어와 같은 viewer_tx 키(viewerCacheKey('viewer_tx', 뷰어 cacheScope, 문장)), storage = localStorage. 읽기만 한다.
 * @returns {Promise<Map<number, {text:string, source:'book'|'device'}>>}
 */
export async function paragraphTranslations({ paragraphs, units, translations, keyOf = null, storage = null }) {
  const out = new Map();
  for (const paragraph of paragraphs || []) {
    if (paragraph.heading) continue;
    const lineUnits = units?.get(paragraph.rawIdx) || [];
    const book = bookTranslation(translations, paragraph, lineUnits);
    if (book) { out.set(paragraph.rawIdx, { text: book, source: 'book' }); continue; }
    if (!keyOf || !storage || !lineUnits.length) continue;
    const parts = [];
    for (const unit of lineUnits) {
      const fromBook = lookupTranslation(translations, unit.text);
      if (fromBook) { parts.push(fromBook); continue; }
      let value = null;
      try { value = storage.getItem(await keyOf(unit.text)); } catch { value = null; }
      const text = cachedTranslationText(value);
      if (!text) break;
      parts.push(text);
    }
    if (parts.length === lineUnits.length) out.set(paragraph.rawIdx, { text: parts.join(' '), source: 'device' });
  }
  return out;
}

/**
 * 긴 묶음 — 쪽에서 갈라져도 되는 해석용 묶음(원문 칸 · 뜻풀이 칸이 쪽을 넘어 이어진다). 짧은 묶음은 통째로 넘겨 원문 · 뜻 · 번역 줄이
 * 한 쪽에 있게 둔다. 기준 = 원문 글자 수(칸 폭 배수 cellScale — 중국어 병음 칸은 글자마다 넓다).
 * 실측(A4 · 12pt · 원문 칸 62%): 한 줄 약 24자 · 한 쪽 약 25줄 — 140자(약 6줄 + 뜻 · 번역 줄)가 쪽의 약 4할이다.
 */
export const LONG_BLOCK_CHARS = 140;
export function isLongBlock(paragraph, { cellScale = 1, sizeScale = 1 } = {}) {
  const chars = (paragraph?.tokens || []).reduce((n, t) => n + [...String(t.text || '')].length, 0);
  return chars * cellScale * sizeScale > LONG_BLOCK_CHARS;
}

/**
 * 출처 줄 — 뷰어 출처 표기와 같은 재료(attributionParts · 정본 책 크레딧), 종이에는 링크 대신 주소를 그대로 적는다.
 * literature = useCanonicalLiterature 결과(정본 대조를 통과했을 때만 — 꾸민 metadata로는 크레딧이 생기지 않는다).
 * @returns {string[]}
 */
export function printAttributionLines(material, literature = null) {
  const lines = [];
  const join = (parts) => parts.filter(Boolean).join(' · ');
  const at = attributionParts(materialSource(material));
  if (at) lines.push(`출처: ${join([at.channel || '유튜브', at.license, at.url])}`);
  const lit = literatureAttributionParts(literature);
  if (lit) {
    lines.push(`출처: ${join([lit.provider, lit.sourceBook && `底本 ${lit.sourceBook}`, lit.inputter && `입력 ${lit.inputter}`,
      lit.proofreader && `교정 ${lit.proofreader}`, lit.publicDomain && '원작 퍼블릭 도메인', lit.cardUrl,
      lit.editNote && '루비는 독음 보조, 장 분할은 manabi 편집', lit.smallKanaNote && '글꼴에 없는 작은 가나는 보통 크기로',
      lit.unproofreadNote && '青空文庫 교정 전 입력본'])}`);
  }
  const credit = (who) => (who ? `${who.name || who}${who.publishedYear ? `, ${who.publishedYear}` : ''}` : '');
  const se = standardEbooksAttributionParts(literature);
  if (se) {
    lines.push(`출처: ${join(['Standard Ebooks', se.author && `${se.author}${se.publishedYear ? `, ${se.publishedYear}` : ''}`,
      se.translator && `번역 ${credit(se.translator)}`, se.publicDomain && '원작 퍼블릭 도메인', se.url,
      se.editNote && (se.notesNote ? '장 분할·글자 정리는 manabi 편집, 삽화·미주는 싣지 않음' : '장 분할·글자 정리는 manabi 편집, 삽화는 싣지 않음')])}`);
  }
  const ws = wikisourceAttributionParts(literature);
  if (ws) {
    lines.push(`출처: ${join(['위키문헌', ws.author && `${ws.author}${ws.publishedYear ? `, ${ws.publishedYear}` : ''}`,
      ws.translator && `번역 ${credit(ws.translator)}`, ws.publicDomain && '원작 퍼블릭 도메인', ws.ccBySa && '전사 CC BY-SA 4.0',
      ws.kogl && `공공누리 제1유형 · 배포 기관 ${ws.kogl}`, ws.url,
      ws.editNote && '장 분할·글자 정리는 manabi 편집, 삽화·주석은 싣지 않음', ws.scriptNote && '간체·번체는 위키문헌 글자 변환'])}`);
  }
  const pd = pdSiteAttributionParts(literature);
  if (pd) {
    lines.push(`출처: ${join([pd.siteName, pd.author && `${pd.author}${pd.publishedYear ? `, ${pd.publishedYear}` : ''}`,
      pd.translator && `번역 ${credit(pd.translator)}`, pd.publicDomain && '한국에서 퍼블릭 도메인', pd.url,
      pd.editNote && (pd.notesNote ? '장 분할·글자 정리는 manabi 편집, 삽화·미주는 싣지 않음' : '장 분할·글자 정리는 manabi 편집, 삽화는 싣지 않음')])}`);
  }
  return lines;
}

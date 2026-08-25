// 책 묶음 반입(오너 승인 P2) — 방대한 텍스트를 "챕터별 분석 가능한" 단위로 분할한다.
// 1차: 헤딩 감지(마크다운 #, 제N장/第N章/Chapter N, 숫자 표제 등 짧은 표제 줄)
// 2차: 헤딩이 없거나 한 조각이 상한을 넘으면 문단(빈 줄) 경계에서 길이 분할.
// 분할 결과는 미리보기에서 사람이 경계를 손볼 수 있다(mergeWithPrevious) — 자동 감지의
// 오차를 UI가 흡수하는 것이 품질의 핵심(조사 결론).

export const CHAPTER_MAX_CHARS = 45000;   // MaterialAddPage 50k 캡 아래 안전 여유
export const CHAPTER_TARGET_CHARS = 15000; // 무헤딩 길이 분할 목표 크기

const HEADING_PATTERNS = [
  /^#{1,3}\s+\S/,                                    // 마크다운 헤딩
  // 주의: 한글·한자는 \w가 아니라 \b가 성립하지 않는다 — 경계 없이 접두 일치로 판정
  /^\s*제\s*\d+\s*[장화막부편과회절](?:\s|$)/,          // 제3장, 제 12 화
  /^\s*第\s*[\d〇一二三四五六七八九十百千]+\s*[章回話话節节課课卷]/, // 第三章 (중·일)
  /^\s*(?:chapter|CHAPTER|Chapter)\s+[\dIVXLC]+/,     // Chapter 7 / CHAPTER IV
  /^\s*(?:prologue|epilogue|프롤로그|에필로그|서장|종장|머리말|맺음말)\s*$/i,
  /^\s*\d{1,3}\s*[.·장화]\s+\S/,                      // "3. 표제", "12장 표제"
];

/** 표제 줄 판정 — 패턴 일치 + 짧고(40자 이하) 문장부호로 끝나지 않는 줄. */
export function isHeadingLine(line) {
  const t = String(line || '').trim();
  if (!t || t.length > 40) return false;
  if (/[。．.!?！？…,、，]$/.test(t)) return false;
  return HEADING_PATTERNS.some((re) => re.test(t));
}

const stripMd = (t) => t.replace(/^#{1,3}\s+/, '').trim();

/** 문단(빈 줄 경계) 묶음 배열로 분해 — 길이 분할의 최소 단위. */
function toParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** 한 덩어리를 문단 경계에서 target 크기 조각들로 — 표제 없는 본문·과대 챕터 공용.
 *  빈 줄 없는 초장문 단일 문단은 줄 경계, 그것도 없으면 글자 수로 하드 분할한다(최후 방어). */
function splitByLength(text, { targetChars, titleBase }) {
  const paras = toParagraphs(text).flatMap((p) => {
    if (p.length <= targetChars) return [p];
    const chunks = [];
    let rest = p;
    while (rest.length > targetChars) {
      const window = rest.slice(0, targetChars);
      const cut = Math.max(window.lastIndexOf('\n'), Math.floor(targetChars * 0.6));
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
  });
  const parts = [];
  let buf = [];
  let len = 0;
  for (const p of paras) {
    if (len > 0 && len + p.length > targetChars) {
      parts.push(buf.join('\n\n'));
      buf = [];
      len = 0;
    }
    buf.push(p);
    len += p.length;
  }
  if (buf.length > 0) parts.push(buf.join('\n\n'));
  if (parts.length <= 1) return [{ title: titleBase, text }];
  return parts.map((t, i) => ({ title: `${titleBase} (${i + 1}/${parts.length})`, text: t }));
}

/**
 * 본문 텍스트 → 챕터 배열 [{title, text}].
 * 헤딩이 2개 이상 감지되면 헤딩 분할(표제 줄이 챕터 제목), 아니면 길이 분할.
 * 어느 경로든 상한(maxChars)을 넘는 챕터는 문단 경계에서 재분할된다.
 */
export function splitTextIntoChapters(rawText, opts = {}) {
  const { targetChars = CHAPTER_TARGET_CHARS, maxChars = CHAPTER_MAX_CHARS } = opts;
  const text = String(rawText || '').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const sections = [];
  let cur = { title: null, lines: [] };
  let headingCount = 0;
  for (const line of lines) {
    if (isHeadingLine(line)) {
      headingCount++;
      if (cur.title != null || cur.lines.some((l) => l.trim())) sections.push(cur);
      cur = { title: stripMd(line), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  sections.push(cur);

  let chapters;
  if (headingCount >= 2) {
    chapters = sections
      .map((s, i) => ({
        title: s.title ?? (s.lines.find((l) => l.trim())?.trim().slice(0, 24) || `도입부`),
        text: s.lines.join('\n').trim(),
      }))
      .filter((c) => c.text.length > 0 || c.title);
    // 표제만 있고 본문이 빈 챕터(연속 표제)는 버린다
    chapters = chapters.filter((c) => c.text.length > 0);
  } else {
    chapters = splitByLength(text, { targetChars, titleBase: '본문' });
  }

  // 상한 초과 챕터는 재분할 — 분석 캡(50k)과 뷰어 성능을 지키는 마지막 방어선
  const out = [];
  for (const ch of chapters) {
    if (ch.text.length > maxChars) {
      out.push(...splitByLength(ch.text, { targetChars: Math.min(targetChars * 2, maxChars), titleBase: ch.title }));
    } else {
      out.push(ch);
    }
  }
  return out;
}

/** 미리보기 경계 조정 — index 챕터를 앞 챕터에 합친다(제목은 앞 챕터 유지). */
export function mergeWithPrevious(chapters, index) {
  if (!Array.isArray(chapters) || index <= 0 || index >= chapters.length) return chapters;
  const merged = chapters.slice();
  const prev = merged[index - 1];
  const cur = merged[index];
  merged.splice(index - 1, 2, { title: prev.title, text: `${prev.text}\n\n${cur.text}` });
  return merged;
}

/* ─────────────────────────────────────────────────────────────
 * 문장 목록 반입(오너 승인 2026-08-25)
 *
 * 한 줄 한 문장으로 나열된 자료(어휘 교재의 예문집·문장 드릴)는 위의 글자 수 분할로는
 * 다룰 수 없다. 실측(HSK5 320문장 ≈ 6,400자): 헤딩이 없어 길이 분할로 가는데 목표
 * 15,000자에 못 미쳐 **챕터 1개·320줄·빈 줄 0**이 나온다. 그 자료를 분석하면
 * analyzeText가 빈 줄 없는 320줄을 문단 하나로 묶어 /api/analyze에 통째로 보내고,
 * 서버는 MAX_LINES=100에서 자른다 → 101번째부터는 결과가 없어 'failed' 플레이스홀더가
 * 되고, 재시도해도 같은 320줄을 다시 보내니 **영구 부분 실패**로 굳는다.
 *
 * 그래서 줄 수로 나눈다. 경계는 책의 실제 과 단위(오너 교재 = 16문장/과)를 사람이
 * 입력하고, 엔진은 요청 캡을 넘지 않게 클램프만 한다.
 * ─────────────────────────────────────────────────────────────*/

/** /api/analyze의 MAX_LINES 미러. 한 챕터의 연속 줄이 이보다 많으면 잘린다(계약 테스트로 고정). */
export const LINES_PER_REQUEST_CAP = 100;

/** 기본 과 크기 — 오너 HSK5 교재 기준. 반입 화면에서 사람이 고친다. */
export const DEFAULT_LINES_PER_CHAPTER = 16;

/** 문장 목록 판정 기준 — 줄이 많고(①) 빈 줄이 거의 없고(②) 줄이 짧다(③). */
export const SENTENCE_LIST_MIN_LINES = 50;
export const SENTENCE_LIST_MAX_BLANK_RATIO = 0.05;
export const SENTENCE_LIST_MAX_AVG_LEN = 40;

/** 문장 목록 통계 — 감지 배너가 "320줄, 평균 18자"를 말하는 근거. 순수. */
export function sentenceListStats(rawText) {
  const raw = String(rawText || '').split('\n');
  const nonEmpty = raw.filter((l) => l.trim());
  const chars = nonEmpty.reduce((n, l) => n + l.trim().length, 0);
  return {
    lines: nonEmpty.length,
    blankRatio: raw.length > 0 ? (raw.length - nonEmpty.length) / raw.length : 0,
    avgLen: nonEmpty.length > 0 ? chars / nonEmpty.length : 0,
  };
}

/**
 * 문장 목록처럼 보이는가 — 배너 노출 판정. 틀려도 배너일 뿐이라 사람이 무시할 수 있다
 * (자동 감지의 오차를 UI가 흡수한다는 이 모듈의 기존 원칙 그대로).
 */
export function looksLikeSentenceList(rawText) {
  const { lines, blankRatio, avgLen } = sentenceListStats(rawText);
  if (lines < SENTENCE_LIST_MIN_LINES) return false;
  if (blankRatio >= SENTENCE_LIST_MAX_BLANK_RATIO) return false;
  return avgLen <= SENTENCE_LIST_MAX_AVG_LEN;
}

/**
 * 과 크기 정규화 — 화면(미리 계산한 챕터 수)과 엔진(실제 분할)이 **같은 규칙**을 쓰게 하는 정본.
 * 두 곳에서 따로 클램프하면 "20챕터"라고 안내하고 320챕터를 만드는 어긋남이 생긴다.
 * - 캡 초과 → 캡(넘으면 /api/analyze가 자른다)
 * - 1 미만·NaN·빈 값 → 기본값(음수를 1로 clamp하면 문장마다 한 챕터가 된다)
 */
export function clampLinesPerChapter(value) {
  const n = Math.floor(Number(value));
  const requested = Number.isFinite(n) && n >= 1 ? n : DEFAULT_LINES_PER_CHAPTER;
  return Math.min(requested, LINES_PER_REQUEST_CAP);
}

/**
 * 줄 수 기준 챕터 분할 — 빈 줄은 버리고 내용 줄만 linesPerChapter개씩 묶는다.
 * 반환형은 splitTextIntoChapters와 **동일**({title, text})이라 등록·미리보기·경계 병합
 * UI가 그대로 재사용된다.
 * @param {string} rawText
 * @param {{linesPerChapter?: number}} opts
 * @returns {Array<{title: string, text: string}>}
 */
export function splitLinesIntoChapters(rawText, opts = {}) {
  const { linesPerChapter = DEFAULT_LINES_PER_CHAPTER } = opts;
  const lines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const per = clampLinesPerChapter(linesPerChapter);
  const out = [];
  for (let i = 0; i < lines.length; i += per) {
    out.push({ title: `${out.length + 1}과`, text: lines.slice(i, i + per).join('\n') });
  }
  return out;
}

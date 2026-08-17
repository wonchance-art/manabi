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
